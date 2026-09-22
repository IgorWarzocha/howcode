import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { expect, it, vi } from 'vitest'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { listAllSessionsStrict } from './session-index.ts'
import { makeShellIndexScheduler } from './shell-index.ts'

vi.mock('../project-import.ts', () => ({ importProjectWorktreesForProjectIds: vi.fn() }))
vi.mock('../runtime/desktop-events.ts', () => ({ emitDesktopEvent: vi.fn() }))
vi.mock('../thread-state-db.ts', () => ({ syncSessionSummaries: vi.fn() }))
vi.mock('./session-index.ts', () => ({
  listAllSessionsStrict: vi.fn(),
  mapSessionSummaryToRecord: vi.fn(),
}))

it('deduplicates refreshes but gives concurrent forced callers one fresh pass, then drains on close', async () => {
  const first = Promise.withResolvers<Awaited<ReturnType<typeof listAllSessionsStrict>>>()
  const second = Promise.withResolvers<Awaited<ReturnType<typeof listAllSessionsStrict>>>()
  const list = vi
    .mocked(listAllSessionsStrict)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  const scope = Scope.makeUnsafe()
  const scheduler = Effect.runSync(Scope.provide(makeShellIndexScheduler(), scope))
  scheduler.schedule('/project')
  const ordinary = Effect.runPromise(scheduler.refresh('/project'))
  const forced = [1, 2].map(() =>
    Effect.runPromise(scheduler.refresh('/project', { force: true, emitRefreshEvent: false })),
  )
  expect(list).toHaveBeenCalledTimes(1)
  first.resolve({ sessions: [], partialFailure: false })
  await expect(ordinary).resolves.toBe(true)
  await expect.poll(() => list.mock.calls.length).toBe(2)
  let closed = false
  const closing = Effect.runPromise(Scope.close(scope, Exit.void)).then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closed).toBe(false)
  second.resolve({ sessions: [], partialFailure: false })
  await expect(Promise.all(forced)).resolves.toEqual([true, true])
  await closing
  expect(emitDesktopEvent).toHaveBeenCalledTimes(1)
})

it('does not mark partial scans as complete, allowing a later background retry', async () => {
  const list = vi
    .mocked(listAllSessionsStrict)
    .mockResolvedValueOnce({ sessions: [], partialFailure: true })
    .mockResolvedValueOnce({ sessions: [], partialFailure: false })
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const scheduler = yield* makeShellIndexScheduler()
        expect(yield* scheduler.refresh('/project')).toBe(false)
        scheduler.schedule('/project')
        expect(yield* scheduler.refresh('/project')).toBe(true)
        scheduler.schedule('/project')
        expect(list).toHaveBeenCalledTimes(2)
      }),
    ),
  )
})
