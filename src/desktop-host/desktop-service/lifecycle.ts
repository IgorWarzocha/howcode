import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberSet from 'effect/FiberSet'
import type * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import { makeDesktopServiceFinalization } from './lifecycle-finalization'
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
    const finalization = makeDesktopServiceFinalization({ events, state, terminal })
    const startup = makeDesktopServiceStartup({
      adapter,
      client,
      finalization,
      runCallback,
      state,
      terminal,
    })

    let ensureStarted: (
      handleMessage: ServiceMessageHandler<Process>,
    ) => Effect.Effect<Process, DesktopServiceError>
    ensureStarted = Effect.fn('DesktopService.ensureStarted')(function* (handleMessage) {
      const ready = yield* Deferred.make<Process, DesktopServiceError>()
      const closed = yield* Deferred.make<void>()
      const scope = yield* Scope.fork(rootScope)
      const decision = yield* Ref.modify(state, (current) =>
        reserveStart({ adapter, current, closed, ready, scope }),
      )

      if (decision.status !== 'Start') yield* Scope.close(scope, Exit.void)
      switch (decision.status) {
        case 'Ready':
          return decision.process
        case 'Wait':
          return yield* Deferred.await(decision.ready)
        case 'WaitClosed':
          yield* Deferred.await(decision.closed)
          return yield* ensureStarted(handleMessage)
        case 'Start':
          return yield* startup.beginReservedStart(decision, ready, handleMessage)
        default:
          return yield* Effect.die('Unknown desktop service start decision.')
      }
    })

    const dispose = Effect.fn('DesktopService.dispose')(function* () {
      const current = (yield* Ref.get(state)).current
      if (!current) return
      if (current.status === 'Stopping') {
        yield* Deferred.await(current.closed)
        return
      }
      const record = yield* finalization.claimStop(current.id)
      if (!record) return
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
