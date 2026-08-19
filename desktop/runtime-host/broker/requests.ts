import * as Clock from 'effect/Clock'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import type { RuntimeHostRequestMap, RuntimeHostRequestName } from '../protocol.ts'
import { getRuntimeHostRequestSessionPath, shouldUseThreadRuntimeHost } from '../request-routing.ts'
import { decodeRuntimeHostResponse } from '../response-schema.ts'
import type { HostLifecycleService, HostMessageHandler } from './lifecycle.ts'
import { makeHostRecord, rememberHostAlias, updateHost, updateMap } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type PendingRequest,
  type RuntimeHostBrokerError,
  type RuntimeHostProcessAdapter,
} from './types.ts'

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

export function makeHostRequestInvoker<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly handleMessage: HostMessageHandler<Process>
  readonly lifecycle: HostLifecycleService<Process>
  readonly serviceHostId: string
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  const { adapter, handleMessage, lifecycle, serviceHostId, state } = options

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
    return yield* adapter.send(process, { type: 'request', id: requestId, name, payload }).pipe(
      Effect.tapError(() => removePending(hostId, requestId, pending)),
      Effect.andThen(Deferred.await(response)),
      Effect.flatMap((result) =>
        Effect.try({
          try: () => decodeRuntimeHostResponse(name, result),
          catch: (error) => brokerError(`decodeResponse:${name}`, error),
        }),
      ),
      Effect.onInterrupt(() => removePending(hostId, requestId, pending)),
    )
  })

  const invoke = Effect.fn('RuntimeHostBroker.invoke')(function* <
    TName extends RuntimeHostRequestName,
  >(name: TName, payload: RuntimeHostRequestMap[TName]) {
    const hostId = yield* getHostForRequest(name, payload)
    return yield* invokeOnHost(hostId, name, payload)
  })

  return { invoke, invokeOnHost }
}
