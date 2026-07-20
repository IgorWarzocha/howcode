import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import type { ServiceMessageHandler } from './lifecycle'
import { updateCurrent, updateMap } from './state'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceError,
  type DesktopServiceMessage,
  type DesktopServiceModuleName,
  type DesktopServiceProcessAdapter,
  type DesktopServiceState,
  type PendingRequest,
  serviceError,
  type TerminalRpcBridge,
} from './types'

export function makeDesktopServiceMessages<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly client: DesktopServiceClientOptions
  readonly ensureStarted: (
    handler: ServiceMessageHandler<Process>,
  ) => Effect.Effect<Process, DesktopServiceError>
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly state: Ref.Ref<DesktopServiceState<Process>>
  readonly terminal: TerminalRpcBridge<Process>
}) {
  const { adapter, client, ensureStarted, events, state, terminal } = options

  const removePending = Effect.fn('DesktopService.removePending')(function* (
    recordId: number,
    requestId: string,
    request: PendingRequest,
  ) {
    yield* Ref.update(state, (current) =>
      updateCurrent(current, recordId, (record) =>
        record.pendingRequests.get(requestId) === request
          ? {
              ...record,
              pendingRequests: updateMap(record.pendingRequests, (pending) =>
                pending.delete(requestId),
              ),
            }
          : record,
      ),
    )
  })

  const handleResponse = Effect.fn('DesktopService.handleResponse')(function* (
    process: Process,
    message: Extract<DesktopServiceMessage, { type: 'response' }>,
  ) {
    const completed = yield* Ref.modify(state, (current) => {
      const record = current.current
      const pending = record?.process === process ? record.pendingRequests.get(message.id) : null
      if (!(record && pending)) return [null, current] as const
      return [
        pending,
        updateCurrent(current, record.id, (active) => ({
          ...active,
          pendingRequests: updateMap(active.pendingRequests, (requests) =>
            requests.delete(message.id),
          ),
        })),
      ] as const
    })
    if (!completed) return
    if (message.ok) yield* Deferred.succeed(completed.response, message.result)
    else {
      const error = new Error(message.error ?? 'Desktop service request failed.')
      if (message.stack) error.stack = message.stack
      yield* Deferred.fail(completed.response, serviceError('response', error))
    }
  })

  const handleMessage = Effect.fn('DesktopService.handleMessage')(function* (
    process: Process,
    message: DesktopServiceMessage,
  ) {
    const current = (yield* Ref.get(state)).current
    if (!current || current.process !== process) return
    switch (message.type) {
      case 'ready':
        return
      case 'desktop-event':
        yield* PubSub.publish(events, message.event)
        return
      case 'terminal-rpc-response':
        yield* Effect.sync(() => terminal.write(message.message))
        return
      case 'response':
        yield* handleResponse(process, message)
        return
      default:
        return
    }
  })

  const invoke = Effect.fn('DesktopService.invoke')(function* (
    moduleName: DesktopServiceModuleName,
    method: string,
    args: readonly unknown[],
  ) {
    const process = yield* ensureStarted(handleMessage)
    const requestId = adapter.makeRequestId()
    const response = yield* Deferred.make<unknown, DesktopServiceError>()
    const pending: PendingRequest = { methodLabel: `${moduleName}.${method}`, response }
    const recordId = yield* Ref.modify(state, (current) => {
      const record = current.current
      if (record?.status !== 'Running' || record.process !== process)
        return [null, current] as const
      return [
        record.id,
        updateCurrent(current, record.id, (active) => ({
          ...active,
          pendingRequests: updateMap(active.pendingRequests, (requests) =>
            requests.set(requestId, pending),
          ),
        })),
      ] as const
    })
    if (recordId === null)
      return yield* Effect.fail(serviceError('invoke', new Error('Desktop service restarted.')))

    return yield* adapter
      .send(process, { type: 'request', id: requestId, module: moduleName, method, args })
      .pipe(
        Effect.andThen(Deferred.await(response)),
        Effect.timeoutOrElse({
          duration: client.requestTimeoutMs ?? 60_000,
          orElse: () =>
            Effect.fail(
              serviceError(
                'requestTimeout',
                new Error(`Timed out waiting for desktop service method ${pending.methodLabel}.`),
              ),
            ),
        }),
        Effect.ensuring(removePending(recordId, requestId, pending)),
      )
  })

  return { handleMessage, invoke }
}
