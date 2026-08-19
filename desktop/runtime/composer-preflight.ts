import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { waitForCondition } from './async-observer.ts'
import type { PiRuntime } from './types.ts'

export async function promptAndReturnAfterPreflight(input: {
  acceptWhen?: (() => boolean) | undefined
  emitComposerUpdate: (request: ComposerStateRequest) => Promise<unknown>
  message: string
  options?: Parameters<PiRuntime['session']['prompt']>[1]
  request: ComposerStateRequest
  runtime: PiRuntime
  scheduleRuntimeDisposal: (runtimeKey: string) => void
}) {
  await Effect.runPromise(
    Effect.gen(function* () {
      const preflight = yield* Deferred.make<boolean>()
      const promptPromise = yield* Effect.sync(() =>
        input.runtime.session.prompt(input.message, {
          ...input.options,
          preflightResult: (success) => {
            Effect.runSync(Deferred.succeed(preflight, success))
          },
        }),
      )
      const prompt = Effect.tryPromise({
        try: async () => await promptPromise,
        catch: (error) => error,
      })
      const accepted = Deferred.await(preflight).pipe(
        Effect.map((success) => ({ type: 'preflight' as const, success })),
      )
      const optimisticAcceptance = input.acceptWhen
        ? waitForCondition(input.acceptWhen, 25).pipe(
            Effect.as({ type: 'preflight' as const, success: true }),
          )
        : Effect.never
      const decision = yield* Effect.raceFirst(
        prompt.pipe(Effect.as({ type: 'settled' as const })),
        Effect.raceFirst(accepted, optimisticAcceptance),
      )

      if (decision.type === 'settled') return
      if (!decision.success) return yield* prompt

      yield* Effect.sync(() => {
        promptPromise
          .catch((error) => {
            console.error('Composer prompt failed after dispatch', error)
            void input.emitComposerUpdate({
              ...input.request,
              sessionPath: getPersistedSessionPath(input.runtime.session.sessionFile),
            })
          })
          .finally(() => {
            const runtimeKey = getPersistedSessionPath(input.runtime.session.sessionFile)
            if (runtimeKey) input.scheduleRuntimeDisposal(runtimeKey)
          })
      })
    }),
  )
}
