import * as Clock from 'effect/Clock'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as Queue from 'effect/Queue'
import { TestClock } from 'effect/testing'
import { expect, it } from 'vitest'
import { retryUpdateTransport } from './update-transport'

it('retries transport failures at 500ms and 1500ms, then preserves the final error', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const attempts = yield* Queue.unbounded<number>()
      const failure = new Error('HTTP 404')
      const clock = yield* Clock.Clock
      const request = retryUpdateTransport(async () => {
        Queue.offerUnsafe(attempts, clock.currentTimeMillisUnsafe())
        throw failure
      })
      const running = yield* Effect.forkChild(Effect.exit(request))
      expect(yield* Queue.take(attempts)).toBe(0)
      yield* TestClock.adjust(500)
      expect(yield* Queue.take(attempts)).toBe(500)
      yield* TestClock.adjust(1000)
      expect(yield* Queue.take(attempts)).toBe(1500)
      expect(yield* Fiber.join(running)).toEqual(Exit.fail(failure))
      expect(yield* Queue.size(attempts)).toBe(0)
    }).pipe(Effect.provide(TestClock.layer())),
  )
})

it('does not schedule another download after success', async () => {
  let attempts = 0
  const value = await Effect.runPromise(
    retryUpdateTransport(async () => {
      attempts += 1
      return 'downloaded'
    }),
  )
  expect(value).toBe('downloaded')
  expect(attempts).toBe(1)
})
