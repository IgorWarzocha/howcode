import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import type { DesktopEvent } from '../../../shared/desktop-contracts.ts'
import { makeHostLifecycle } from './lifecycle.ts'
import { makeHostMessages } from './messages.ts'
import { makeBrokerState } from './state.ts'
import type { RuntimeHostBroker, RuntimeHostProcessAdapter } from './types.ts'

export function makeRuntimeHostBroker<Process>(
  adapter: RuntimeHostProcessAdapter<Process>,
  options: { readonly idleTimeout: Duration.Input },
): Effect.Effect<RuntimeHostBroker, never, Scope.Scope> {
  return Effect.gen(function* () {
    const serviceHostId = adapter.makeId()
    const state = yield* Ref.make(makeBrokerState<Process>(serviceHostId))
    const events = yield* PubSub.unbounded<DesktopEvent>()
    const lifecycle = yield* makeHostLifecycle({
      adapter,
      idleTimeout: options.idleTimeout,
      state,
    })
    const messages = makeHostMessages({ adapter, events, lifecycle, serviceHostId, state })

    return {
      events: Stream.fromPubSub(events),
      ensureServiceHost: messages.ensureServiceHost,
      invoke: messages.invoke,
      invalidateSettings: messages.invalidateSettings,
      disposeWorkspace: messages.disposeWorkspace,
      restart: lifecycle.stopAll(false),
      shutdown: lifecycle.stopAll(true),
    }
  })
}
