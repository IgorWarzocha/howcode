import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as Ref from 'effect/Ref'
import { describe, expect, it } from 'vitest'
import { makeShutdownCoordinator } from '../../shared/effect-shutdown'

describe('Effect shutdown coordinator', () => {
  it('runs cleanup once and shares its completion', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const cleanupStarted = yield* Deferred.make<void>()
        const allowCleanup = yield* Deferred.make<void>()
        const cleanupCount = yield* Ref.make(0)
        const coordinator = yield* makeShutdownCoordinator(
          Effect.gen(function* () {
            yield* Ref.update(cleanupCount, (count) => count + 1)
            yield* Deferred.succeed(cleanupStarted, undefined)
            yield* Deferred.await(allowCleanup)
          }),
          { label: 'Test runtime', timeout: '1 minute' },
        )
        const callers = yield* Effect.all([coordinator.shutdown, coordinator.shutdown], {
          concurrency: 'unbounded',
          discard: true,
        }).pipe(Effect.forkScoped)

        yield* Deferred.await(cleanupStarted)
        expect(yield* Ref.get(cleanupCount)).toBe(1)
        yield* Deferred.succeed(allowCleanup, undefined)
        yield* Fiber.join(callers)
        yield* coordinator.shutdown
        expect(yield* Ref.get(cleanupCount)).toBe(1)
      }).pipe(Effect.scoped),
    )
  })
})
