import type * as Deferred from 'effect/Deferred'
import type * as Scope from 'effect/Scope'
import { updateHost } from './state.ts'
import type {
  BrokerState,
  HostRecord,
  RuntimeHostBrokerError,
  RuntimeHostProcessAdapter,
} from './types.ts'

export type StartDecision<Process> =
  | { readonly status: 'Ready'; readonly process: Process }
  | { readonly status: 'Wait'; readonly ready: Deferred.Deferred<Process, RuntimeHostBrokerError> }
  | { readonly status: 'Start'; readonly staleScope: Scope.Closeable | null }
  | { readonly status: 'Unavailable'; readonly message: string }

export function hostProcess<Process>(host: HostRecord<Process>) {
  return host.lifecycle.status === 'Running' || host.lifecycle.status === 'Stopping'
    ? host.lifecycle.process
    : host.lifecycle.status === 'Starting'
      ? host.lifecycle.process
      : null
}

export function reserveHostStart<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly current: BrokerState<Process>
  readonly hostId: string
  readonly ready: Deferred.Deferred<Process, RuntimeHostBrokerError>
  readonly scope: Scope.Closeable
}): readonly [StartDecision<Process>, BrokerState<Process>] {
  const { adapter, current, hostId, ready, scope } = options
  const host = current.hosts.get(hostId)
  if (!host) return [{ status: 'Unavailable', message: 'Pi runtime host was removed.' }, current]
  if (current.shuttingDown)
    return [{ status: 'Unavailable', message: 'Pi runtime host is shutting down.' }, current]
  if (host.lifecycle.status === 'Starting')
    return [{ status: 'Wait', ready: host.lifecycle.ready }, current]
  if (host.lifecycle.status === 'Stopping')
    return [
      { status: 'Unavailable', message: `Pi runtime host ${host.label} is stopping.` },
      current,
    ]
  if (host.lifecycle.status === 'Running' && adapter.isRunning(host.lifecycle.process))
    return [{ status: 'Ready', process: host.lifecycle.process }, current]

  const staleScope = host.lifecycle.status === 'Running' ? host.lifecycle.scope : null
  return [
    { status: 'Start', staleScope },
    updateHost(current, hostId, (record) => ({
      ...record,
      lifecycle: { status: 'Starting', process: null, ready, scope },
    })),
  ]
}
