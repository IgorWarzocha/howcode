import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'

type ShutdownState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly completion: Deferred.Deferred<void> }
  | { readonly status: 'complete' }

type ShutdownDecision =
  | { readonly status: 'start' }
  | { readonly status: 'wait'; readonly completion: Deferred.Deferred<void> }
  | { readonly status: 'complete' }

export interface ShutdownCoordinator {
  readonly shutdown: Effect.Effect<void>
}

export function makeShutdownCoordinator(
  cleanup: Effect.Effect<void, unknown>,
  options: { readonly label: string; readonly timeout: Duration.Input },
): Effect.Effect<ShutdownCoordinator> {
  return Effect.gen(function* () {
    const state = yield* Ref.make<ShutdownState>({ status: 'idle' })

    const runCleanup = cleanup.pipe(
      Effect.timeoutOrElse({
        duration: options.timeout,
        orElse: () =>
          Effect.sync(() => console.warn(`${options.label} timed out during shutdown.`)),
      }),
      Effect.catchCause((cause) =>
        Effect.sync(() =>
          console.warn(`${options.label} failed during shutdown.`, Cause.squash(cause)),
        ),
      ),
      Effect.asVoid,
    )

    const shutdown = Effect.fn(`${options.label}.shutdown`)(function* () {
      const completion = yield* Deferred.make<void>()
      const reserve = (current: ShutdownState): readonly [ShutdownDecision, ShutdownState] => {
        if (current.status === 'complete') return [{ status: 'complete' as const }, current]
        if (current.status === 'running')
          return [{ status: 'wait' as const, completion: current.completion }, current]
        return [{ status: 'start' as const }, { status: 'running' as const, completion }]
      }
      const decision = yield* Ref.modify(state, reserve)

      if (decision.status === 'complete') return
      if (decision.status === 'wait') return yield* Deferred.await(decision.completion)

      yield* runCleanup.pipe(Effect.ensuring(Deferred.succeed(completion, undefined)))
      yield* Ref.set(state, { status: 'complete' })
      return undefined
    })

    return { shutdown: shutdown() }
  })
}
