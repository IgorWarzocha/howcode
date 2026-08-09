import * as Effect from 'effect/Effect'
import type * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import type { DesktopEvent } from '../../../shared/desktop-contracts.ts'
import type { HostLifecycleService } from './lifecycle.ts'
import { makeHostMessageHandler } from './message-inbound.ts'
import { makeHostRequestInvoker } from './requests.ts'
import { updateHost } from './state.ts'
import type { BrokerState, RuntimeHostBroker, RuntimeHostProcessAdapter } from './types.ts'

export function makeHostMessages<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly lifecycle: HostLifecycleService<Process>
  readonly serviceHostId: string
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  const { adapter, events, lifecycle, serviceHostId, state } = options
  const handleMessage = makeHostMessageHandler({ events, lifecycle, state })
  const { invoke, invokeOnHost } = makeHostRequestInvoker({
    adapter,
    handleMessage,
    lifecycle,
    serviceHostId,
    state,
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
