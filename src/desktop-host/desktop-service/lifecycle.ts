import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as FiberSet from 'effect/FiberSet'
import type * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import { makeDesktopServiceFinalization } from './lifecycle-finalization'
import { makeDesktopServiceRecovery } from './lifecycle-recovery'
import { makeDesktopServiceStartup } from './lifecycle-startup'
import { reserveStart } from './lifecycle-state'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceError,
  type DesktopServiceProcessAdapter,
  type DesktopServiceState,
  type ServiceMessageHandler,
  serviceError,
  type TerminalRpcBridge,
} from './types'

export type { ServiceMessageHandler } from './types'

export function makeDesktopServiceLifecycle<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly client: DesktopServiceClientOptions
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly state: Ref.Ref<DesktopServiceState<Process>>
  readonly terminal: TerminalRpcBridge<Process>
}) {
  return Effect.gen(function* () {
    const { adapter, client, events, state, terminal } = options
    const rootScope = yield* Scope.Scope
    const runCallback = yield* FiberSet.makeRuntime<never, unknown, never>()
    const recoveryEnabled = yield* Deferred.make<ServiceMessageHandler<Process>>()
    const finalization = makeDesktopServiceFinalization({ events, state, terminal })
    const startup = makeDesktopServiceStartup({
      adapter,
      client,
      finalization,
      onReady: (handler) => Deferred.succeed(recoveryEnabled, handler),
      runCallback,
      state,
      terminal,
    })

    let ensureStarted: (
      handleMessage: ServiceMessageHandler<Process>,
    ) => Effect.Effect<Process, DesktopServiceError>
    ensureStarted = Effect.fn('DesktopService.ensureStarted')((handleMessage) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const ready = yield* Deferred.make<Process, DesktopServiceError>()
          const closed = yield* Deferred.make<void, DesktopServiceError>()
          const scope = yield* Scope.fork(rootScope)
          const decision = yield* Ref.modify(state, (current) =>
            reserveStart({ adapter, current, closed, ready, scope }),
          )

          // A reservation must launch its owned work before the caller can cancel its wait.
          if (decision.status !== 'Start') yield* Scope.close(scope, Exit.void)
          switch (decision.status) {
            case 'Disposed':
              return yield* Effect.fail(
                serviceError('start', new Error('Desktop service is disposed.')),
              )
            case 'Ready':
              return decision.process
            case 'Wait':
              return yield* restore(Deferred.await(decision.ready))
            case 'WaitClosed':
              yield* restore(Deferred.await(decision.closed))
              return yield* restore(ensureStarted(handleMessage))
            case 'StopStale':
              yield* startup.stopStale(decision.record)
              yield* restore(Deferred.await(decision.record.closed))
              return yield* restore(ensureStarted(handleMessage))
            case 'Start':
              yield* startup.launchReservedStart(ready, handleMessage)
              return yield* restore(Deferred.await(ready))
            default:
              return yield* Effect.die('Unknown desktop service start decision.')
          }
        }),
      ),
    )

    const recovery = yield* makeDesktopServiceRecovery({
      enabled: recoveryEnabled,
      ensureStarted,
      state,
    }).pipe(Effect.forkIn(rootScope))

    const dispose = Effect.fn('DesktopService.dispose')(function* () {
      const current = yield* Ref.modify(state, (active) => [
        active.current,
        { ...active, disposed: true },
      ])
      yield* Fiber.interrupt(recovery)
      if (!current) return
      if (current.status === 'Stopping') {
        yield* Deferred.await(current.closed)
        return
      }
      const record = yield* finalization.claimStop(current.id)
      if (!record) {
        yield* Deferred.await(current.closed)
        return
      }
      yield* finalization.failAndFinalize(
        record,
        serviceError('dispose', new Error('Desktop service is shutting down.')),
      )
    })

    return {
      currentProcess: Effect.map(Ref.get(state), (current) => current.current?.process ?? null),
      dispose: dispose(),
      ensureStarted,
    }
  })
}
