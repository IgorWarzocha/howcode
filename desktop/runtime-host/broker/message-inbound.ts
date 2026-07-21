import * as Clock from 'effect/Clock'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type { DesktopEvent } from '../../../shared/desktop-contracts.ts'
import type { RuntimeHostToMainMessage } from '../protocol.ts'
import { type HostLifecycleService, hostProcess } from './lifecycle.ts'
import { rememberHostAlias, updateHost, updateMap } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type HostRecord,
  type RuntimeHostProcessAdapter,
} from './types.ts'

const SERVICE_HOST_SEND_ALIAS_WINDOW_MS = 30_000

function responseError<Process>(
  host: HostRecord<Process>,
  message: Extract<RuntimeHostToMainMessage, { type: 'response'; ok: false }>,
) {
  const error = new Error(message.error)
  if (message.stack) error.stack = message.stack
  return brokerError(`response:${host.label}`, error)
}

export function makeHostMessageHandler<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly lifecycle: HostLifecycleService<Process>
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  const { adapter, events, lifecycle, state } = options

  const hostOwnsRecentSend = Effect.fn('RuntimeHostBroker.hostOwnsRecentSend')(function* (
    host: HostRecord<Process>,
  ) {
    if ([...host.pendingRequests.values()].some((pending) => pending.name === 'sendComposerPrompt'))
      return true
    if (host.lastSendComposerPromptAtMs === null) return false
    const now = yield* Clock.currentTimeMillis
    return now - host.lastSendComposerPromptAtMs < SERVICE_HOST_SEND_ALIAS_WINDOW_MS
  })

  const handleDesktopEvent = Effect.fn('RuntimeHostBroker.handleDesktopEvent')(function* (
    hostId: string,
    event: DesktopEvent,
  ) {
    if (event.type === 'thread-update') {
      const host = (yield* Ref.get(state)).hosts.get(hostId)
      if (host) {
        const ownsRecentSend = yield* hostOwnsRecentSend(host)
        yield* Ref.update(state, (current) => {
          const withAlias =
            host.role === 'thread' || ownsRecentSend
              ? rememberHostAlias(current, hostId, event.sessionPath)
              : current
          return updateHost(withAlias, hostId, (record) => ({
            ...record,
            busy: event.thread.isStreaming || event.thread.isCompacting,
          }))
        })
        if (event.thread.isStreaming || event.thread.isCompacting)
          yield* lifecycle.suspendIdle(hostId)
        else yield* lifecycle.scheduleIdle(hostId)
      }
    }
    yield* PubSub.publish(events, event)
  })

  const handleResponse = Effect.fn('RuntimeHostBroker.handleResponse')(function* (
    hostId: string,
    message: Extract<RuntimeHostToMainMessage, { type: 'response' }>,
  ) {
    const completed = yield* Ref.modify(state, (current) => {
      const host = current.hosts.get(hostId)
      const pending = host?.pendingRequests.get(message.id)
      if (!(host && pending)) return [null, current] as const
      const sendStopped =
        pending.name === 'sendComposerPrompt' &&
        !(
          message.ok &&
          typeof message.result === 'object' &&
          message.result !== null &&
          'outcome' in message.result &&
          message.result.outcome === 'sent'
        )
      return [
        { host, pending },
        updateHost(current, hostId, (record) => ({
          ...record,
          pendingRequests: updateMap(record.pendingRequests, (requests) =>
            requests.delete(message.id),
          ),
          busy: sendStopped ? false : record.busy,
        })),
      ] as const
    })
    if (!completed) return
    yield* lifecycle.scheduleIdle(hostId)
    if (message.ok) yield* Deferred.succeed(completed.pending.response, message.result)
    else yield* Deferred.fail(completed.pending.response, responseError(completed.host, message))
  })

  return Effect.fn('RuntimeHostBroker.handleMessage')(function* (
    hostId: string,
    process: Process,
    message: RuntimeHostToMainMessage,
  ) {
    const host = (yield* Ref.get(state)).hosts.get(hostId)
    if (!host || hostProcess(host) !== process) return
    switch (message.type) {
      case 'desktop-event':
        yield* handleDesktopEvent(hostId, message.event)
        return
      case 'host-error':
        yield* Effect.sync(() =>
          console.error(`Pi runtime host error (${host.label})`, message.error, message.stack),
        )
        return
      case 'main-request':
        yield* adapter.send(process, {
          type: 'main-response',
          id: message.id,
          ok: false,
          error: `Runtime host-local service request ${message.name} must be handled inside the runtime host.`,
        })
        return
      case 'response':
        yield* handleResponse(hostId, message)
        return
      default:
        return
    }
  })
}
