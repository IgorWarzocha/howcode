import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { expect, it, vi } from 'vitest'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import { makeThreadUpdateForwarder } from './thread-update-forwarding.ts'

function update(
  sessionPath: string,
  title: string,
): Extract<DesktopEvent, { type: 'thread-update' }> {
  return {
    type: 'thread-update',
    reason: 'update',
    projectId: '/project',
    threadId: sessionPath,
    sessionPath,
    composer: null,
    thread: {
      sessionPath,
      title,
      messages: [],
      previousMessageCount: 0,
      isStreaming: false,
      isCompacting: false,
    },
  }
}

it('orders persistence before forwarding per session, isolates failures, and drains accepted updates on close', async () => {
  const first = Promise.withResolvers<void>()
  const otherForwarded = Promise.withResolvers<void>()
  const steps: string[] = []
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const scope = Scope.makeUnsafe()
  try {
    const forward = Effect.runSync(
      Scope.provide(
        makeThreadUpdateForwarder(async (event) => {
          steps.push(`persist:${event.thread.title}`)
          if (event.thread.title === 'a1') {
            await first.promise
            throw new Error('persistence failed')
          }
        }),
        scope,
      ),
    )
    const listener = (event: DesktopEvent) => {
      if (event.type !== 'thread-update') throw new Error('Unexpected event.')
      steps.push(`listen:${event.thread.title}`)
      if (event.thread.title === 'b') otherForwarded.resolve()
      if (event.thread.title === 'a1') throw new Error('listener failed')
    }
    forward(update('/session-a', 'a1'), listener)
    forward(update('/session-a', 'a2'), listener)
    forward(update('/session-b', 'b'), listener)
    await otherForwarded.promise
    expect(steps).toEqual(['persist:a1', 'persist:b', 'listen:b'])
    let closed = false
    const closing = Effect.runPromise(Scope.close(scope, Exit.void)).then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    first.resolve()
    await closing
    expect(steps).toEqual([
      'persist:a1',
      'persist:b',
      'listen:b',
      'listen:a1',
      'persist:a2',
      'listen:a2',
    ])
    expect(warning).toHaveBeenCalledTimes(2)
  } finally {
    first.resolve()
    await Effect.runPromise(Scope.close(scope, Exit.void))
    warning.mockRestore()
  }
})
