import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import { expect, it } from 'vitest'
import { makeRuntimeRegistryState } from './live-runtime-registry-state.ts'

it('keeps keys and lock spaces independent and releases a key after holder/waiter interruption', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const state = yield* makeRuntimeRegistryState()
        const entered = yield* Deferred.make<void>()
        const holder = yield* state
          .withMutationLock(
            'a',
            Effect.gen(function* () {
              yield* Deferred.succeed(entered, undefined)
              yield* Effect.never
            }),
          )
          .pipe(Effect.forkScoped)
        yield* Deferred.await(entered)
        let cancelledRan = false
        const cancelled = yield* state
          .withMutationLock(
            'a',
            Effect.sync(() => {
              cancelledRan = true
            }),
          )
          .pipe(Effect.forkScoped)
        yield* Effect.yieldNow
        expect(yield* state.withMutationLock('b', Effect.succeed('other key'))).toBe('other key')
        expect(yield* state.withLifecycleLock('a', Effect.succeed('other lock'))).toBe('other lock')
        yield* Fiber.interrupt(cancelled)
        const next = yield* state
          .withMutationLock('a', Effect.succeed('next'))
          .pipe(Effect.forkScoped)
        yield* Fiber.interrupt(holder)
        expect(yield* Fiber.join(next)).toBe('next')
        expect(cancelledRan).toBe(false)
      }),
    ),
  )
})
