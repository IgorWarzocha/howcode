import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'
import { makeRuntimeUpdateScheduler } from './live-runtime-updates.ts'

describe('Live runtime update scheduling', () => {
  it('cancels deferred publications when the runtime scope closes', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtimeScope = yield* Scope.make()
        const scheduler = yield* makeRuntimeUpdateScheduler.pipe(Scope.provide(runtimeScope))
        const publications = yield* Ref.make(0)

        scheduler.scheduleThread(() =>
          Effect.runPromise(Ref.update(publications, (count) => count + 1)),
        )
        yield* Scope.close(runtimeScope, Exit.void)
        yield* TestClock.adjust('1 second')

        expect(scheduler.isActive()).toBe(false)
        expect(yield* Ref.get(publications)).toBe(0)
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })
})
