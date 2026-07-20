import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import { makeDesktopServiceLifecycle } from './lifecycle'
import { makeDesktopServiceMessages } from './messages'
import { makeDesktopServiceState } from './state'
import type {
  DesktopServiceClientOptions,
  DesktopServiceCore,
  DesktopServiceProcessAdapter,
  TerminalRpcBridge,
} from './types'

export function makeDesktopServiceCore<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly client: DesktopServiceClientOptions
  readonly terminal: TerminalRpcBridge<Process>
}): Effect.Effect<DesktopServiceCore<Process>, never, Scope.Scope> {
  return Effect.gen(function* () {
    const state = yield* Ref.make(makeDesktopServiceState<Process>())
    const events = yield* PubSub.unbounded<DesktopEvent>()
    const lifecycle = yield* makeDesktopServiceLifecycle({ ...options, events, state })
    const messages = makeDesktopServiceMessages({
      ...options,
      ensureStarted: lifecycle.ensureStarted,
      events,
      state,
    })

    return {
      events: Stream.fromPubSub(events),
      currentProcess: lifecycle.currentProcess,
      ensureStarted: lifecycle.ensureStarted(messages.handleMessage),
      invoke: messages.invoke,
      dispose: lifecycle.dispose,
    }
  })
}
