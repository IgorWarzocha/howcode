import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'
import { waitForConditionOrSettlement } from './async-observer.ts'

describe('async observer', () => {
  it('observes a condition on the configured schedule', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        let checks = 0
        const observed = yield* waitForConditionOrSettlement(
          () => {
            checks += 1
            return checks === 2
          },
          new Promise(() => {
            // The competing operation remains in flight.
          }),
          '50 millis',
        ).pipe(Effect.forkScoped)

        yield* Effect.yieldNow
        expect(checks).toBe(1)
        yield* TestClock.adjust('50 millis')
        expect(yield* Fiber.join(observed)).toBe('condition')
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })
})
