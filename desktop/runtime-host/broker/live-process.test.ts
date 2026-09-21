import { EventEmitter } from 'node:events'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { afterEach, expect, it, vi } from 'vitest'
import { liveProcessAdapter } from './live-process.ts'

afterEach(() => vi.restoreAllMocks())

it('leaves signal shutdown with the entrypoint until persistence cleanup finishes', async () => {
  const lifecycle = new EventEmitter()
  const completed: string[] = []
  const cleanup = Promise.withResolvers<void>()
  const shutdown = Promise.withResolvers<void>()
  const originalOnce = process.once.bind(process)
  const originalOff = process.off.bind(process)
  const lifecycleEvents = new Set<string | symbol>(['exit', 'SIGTERM', 'SIGINT'])
  vi.spyOn(process, 'once').mockImplementation((event, listener) => {
    if (!lifecycleEvents.has(event)) return originalOnce(event, listener)
    lifecycle.once(event, listener)
    return process
  })
  vi.spyOn(process, 'off').mockImplementation((event, listener) => {
    if (!lifecycleEvents.has(event)) return originalOff(event, listener)
    lifecycle.off(event, listener)
    return process
  })
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Broker bypassed entrypoint cleanup.')
  })

  lifecycle.once('SIGTERM', () => {
    void cleanup.promise.then(() => {
      completed.push('database closed')
      lifecycle.emit('exit')
      shutdown.resolve()
    })
  })
  const scope = Scope.makeUnsafe()
  try {
    Effect.runSync(
      Scope.provide(
        liveProcessAdapter.installShutdownHandlers(() => completed.push('children stopped')),
        scope,
      ),
    )
    lifecycle.emit('SIGTERM')
    expect(completed).toEqual([])
    cleanup.resolve()
    await shutdown.promise
    expect(completed).toEqual(['database closed', 'children stopped'])
  } finally {
    cleanup.resolve()
    await Effect.runPromise(Scope.close(scope, Exit.void))
  }
})
