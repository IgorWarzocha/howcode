import type { BrokerState, HostRecord, HostRole } from './types.ts'

export function updateMap<K, V>(source: ReadonlyMap<K, V>, update: (copy: Map<K, V>) => void) {
  const copy = new Map(source)
  update(copy)
  return copy
}

export function makeHostRecord<Process>(
  id: string,
  role: HostRole,
  label: string,
): HostRecord<Process> {
  return {
    id,
    role,
    label,
    aliases: new Set(),
    pendingRequests: new Map(),
    lifecycle: { status: 'Stopped' },
    busy: false,
    lastSendComposerPromptAtMs: null,
  }
}

export function makeBrokerState<Process>(serviceHostId: string): BrokerState<Process> {
  const serviceHost = makeHostRecord<Process>(serviceHostId, 'service', 'service')
  return {
    hosts: new Map([[serviceHostId, serviceHost]]),
    hostByAlias: new Map(),
    serviceHostId,
    shuttingDown: false,
  }
}

export function updateHost<Process>(
  state: BrokerState<Process>,
  hostId: string,
  update: (host: HostRecord<Process>) => HostRecord<Process>,
) {
  const host = state.hosts.get(hostId)
  if (!host) return state
  return {
    ...state,
    hosts: updateMap(state.hosts, (hosts) => hosts.set(hostId, update(host))),
  }
}

export function rememberHostAlias<Process>(
  state: BrokerState<Process>,
  hostId: string,
  alias: string | null | undefined,
) {
  const normalized = alias?.trim()
  const host = state.hosts.get(hostId)
  if (!(normalized && host) || host.lifecycle.status === 'Stopping') return state
  return {
    ...state,
    hosts: updateMap(state.hosts, (hosts) =>
      hosts.set(hostId, { ...host, aliases: new Set([...host.aliases, normalized]) }),
    ),
    hostByAlias: updateMap(state.hostByAlias, (aliases) => aliases.set(normalized, hostId)),
  }
}

export function forgetHost<Process>(state: BrokerState<Process>, hostId: string) {
  const host = state.hosts.get(hostId)
  if (!host) return state

  const hostByAlias = updateMap(state.hostByAlias, (aliases) => {
    for (const alias of host.aliases) {
      if (aliases.get(alias) === hostId) aliases.delete(alias)
    }
  })
  if (host.role === 'service') {
    return {
      ...state,
      hostByAlias,
      hosts: updateMap(state.hosts, (hosts) =>
        hosts.set(hostId, {
          ...host,
          aliases: new Set(),
          pendingRequests: new Map(),
          lifecycle: { status: 'Stopped' },
          busy: false,
          lastSendComposerPromptAtMs: null,
        }),
      ),
    }
  }
  return {
    ...state,
    hostByAlias,
    hosts: updateMap(state.hosts, (hosts) => hosts.delete(hostId)),
  }
}

export function resetBrokerHosts<Process>(state: BrokerState<Process>, shuttingDown: boolean) {
  const serviceHost = state.hosts.get(state.serviceHostId)
  const resetServiceHost = serviceHost
    ? {
        ...serviceHost,
        aliases: new Set<string>(),
        pendingRequests: new Map(),
        lifecycle: { status: 'Stopped' as const },
        busy: false,
        lastSendComposerPromptAtMs: null,
      }
    : makeHostRecord<Process>(state.serviceHostId, 'service', 'service')
  return {
    hosts: new Map([[state.serviceHostId, resetServiceHost]]),
    hostByAlias: new Map<string, string>(),
    serviceHostId: state.serviceHostId,
    shuttingDown,
  }
}
