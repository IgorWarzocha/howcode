import * as Clock from 'effect/Clock'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type { DesktopEvent } from '../../../shared/desktop-contracts.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
} from '../protocol.ts'
import { getRuntimeHostRequestSessionPath, shouldUseThreadRuntimeHost } from '../request-routing.ts'
import { type HostLifecycleService, hostProcess } from './lifecycle.ts'
import { makeHostRecord, rememberHostAlias, updateHost, updateMap } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type HostRecord,
  type PendingRequest,
  type RuntimeHostBroker,
  type RuntimeHostBrokerError,
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

function removeRegisteredPending<Process>(
  current: BrokerState<Process>,
  hostId: string,
  requestId: string,
  request: PendingRequest,
) {
  return updateHost(current, hostId, (host) => {
    if (host.pendingRequests.get(requestId) !== request) return host
    return {
      ...host,
      pendingRequests: updateMap(host.pendingRequests, (pending) => pending.delete(requestId)),
      busy: request.name === 'sendComposerPrompt' ? false : host.busy,
      lastSendComposerPromptAtMs:
        request.name === 'sendComposerPrompt' ? null : host.lastSendComposerPromptAtMs,
    }
  })
}

export function makeHostMessages<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly lifecycle: HostLifecycleService<Process>
  readonly serviceHostId: string
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  const { adapter, events, lifecycle, serviceHostId, state } = options

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

  const handleMessage = Effect.fn('RuntimeHostBroker.handleMessage')(function* (
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

  const getHostForRequest = Effect.fn('RuntimeHostBroker.getHostForRequest')(function* <
    TName extends RuntimeHostRequestName,
  >(name: TName, payload: RuntimeHostRequestMap[TName]) {
    const sessionPath = getRuntimeHostRequestSessionPath(name, payload)
    if (!shouldUseThreadRuntimeHost(name, payload)) return serviceHostId

    return yield* Ref.modify(state, (current) => {
      const existingHostId = sessionPath ? current.hostByAlias.get(sessionPath) : null
      const existingHost = existingHostId ? current.hosts.get(existingHostId) : null
      if (existingHost && existingHost.lifecycle.status !== 'Stopping')
        return [existingHost.id, current] as const

      const hostId = adapter.makeId()
      const host = makeHostRecord<Process>(
        hostId,
        'thread',
        sessionPath ?? `thread-${current.hosts.size}`,
      )
      const withHost = {
        ...current,
        hosts: updateMap(current.hosts, (hosts) => hosts.set(hostId, host)),
      }
      return [hostId, rememberHostAlias(withHost, hostId, sessionPath)] as const
    })
  })

  const removePending = Effect.fn('RuntimeHostBroker.removePending')(function* (
    hostId: string,
    requestId: string,
    request: PendingRequest,
  ) {
    yield* Ref.update(state, (current) =>
      removeRegisteredPending(current, hostId, requestId, request),
    )
    yield* lifecycle.scheduleIdle(hostId)
  })

  const invokeOnHost = Effect.fn('RuntimeHostBroker.invokeOnHost')(function* <
    TName extends RuntimeHostRequestName,
  >(hostId: string, name: TName, payload: RuntimeHostRequestMap[TName]) {
    const process = yield* lifecycle.ensureHost(hostId, handleMessage)
    const requestId = adapter.makeId()
    const response = yield* Deferred.make<unknown, RuntimeHostBrokerError>()
    const pending: PendingRequest = { name, response }
    const now = yield* Clock.currentTimeMillis
    const registered = yield* Ref.modify(state, (current) => {
      const host = current.hosts.get(hostId)
      if (
        host?.lifecycle.status !== 'Running' ||
        host.lifecycle.process !== process ||
        current.shuttingDown
      ) {
        return [false, current] as const
      }
      return [
        true,
        updateHost(current, hostId, (record) => ({
          ...record,
          pendingRequests: updateMap(record.pendingRequests, (requests) =>
            requests.set(requestId, pending),
          ),
          busy: name === 'sendComposerPrompt' ? true : record.busy,
          lastSendComposerPromptAtMs:
            name === 'sendComposerPrompt' ? now : record.lastSendComposerPromptAtMs,
        })),
      ] as const
    })
    if (!registered)
      return yield* Effect.fail(
        brokerError('invoke', new Error('Pi runtime host became unavailable.')),
      )

    yield* lifecycle.suspendIdle(hostId)
    const result = yield* adapter
      .send(process, { type: 'request', id: requestId, name, payload })
      .pipe(
        Effect.tapError(() => removePending(hostId, requestId, pending)),
        Effect.andThen(Deferred.await(response)),
        Effect.onInterrupt(() => removePending(hostId, requestId, pending)),
      )
    return result as RuntimeHostResponseMap[TName]
  })

  const invoke = Effect.fn('RuntimeHostBroker.invoke')(function* <
    TName extends RuntimeHostRequestName,
  >(name: TName, payload: RuntimeHostRequestMap[TName]) {
    const hostId = yield* getHostForRequest(name, payload)
    return yield* invokeOnHost(hostId, name, payload)
  })

  const invalidateSettings = Effect.fn('RuntimeHostBroker.invalidateSettings')(function* (
    request: Parameters<RuntimeHostBroker['invalidateSettings']>[0],
  ) {
    const snapshot = yield* Ref.get(state)
    const targetIds = request.sessionPath
      ? [snapshot.hostByAlias.get(request.sessionPath)].filter(
          (hostId): hostId is string => hostId !== undefined,
        )
      : [...snapshot.hosts.keys()]
    yield* Effect.forEach(
      targetIds,
      (hostId) => {
        const host = snapshot.hosts.get(hostId)
        return host && host.lifecycle.status !== 'Stopped'
          ? invokeOnHost(hostId, 'invalidateRuntimeSettings', request).pipe(
              Effect.catch((error) =>
                Effect.sync(() =>
                  console.warn(
                    `Failed to invalidate Pi runtime host settings (${host.label}).`,
                    error,
                  ),
                ),
              ),
            )
          : Effect.void
      },
      { discard: true, concurrency: 'unbounded' },
    )
  })

  const disposeWorkspace = Effect.fn('RuntimeHostBroker.disposeWorkspace')(function* (
    request: Parameters<RuntimeHostBroker['disposeWorkspace']>[0],
  ) {
    const hostIds = yield* lifecycle.runningHostIds
    yield* Effect.forEach(
      hostIds,
      (hostId) =>
        invokeOnHost(hostId, 'disposeRuntimeHosts', {
          ...request,
          sessionPaths: [...request.sessionPaths],
        }).pipe(
          Effect.tap(() =>
            Ref.update(state, (current) =>
              updateHost(current, hostId, (host) => ({ ...host, busy: false })),
            ),
          ),
          Effect.tap(() => lifecycle.scheduleIdle(hostId)),
        ),
      { discard: true, concurrency: 'unbounded' },
    )
  })

  return {
    disposeWorkspace,
    ensureServiceHost: Effect.asVoid(lifecycle.ensureHost(serviceHostId, handleMessage)),
    invalidateSettings,
    invoke,
  }
}
