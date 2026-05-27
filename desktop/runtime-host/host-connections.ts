import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import type { RuntimeHostRequestName, RuntimeHostResponseMap } from './protocol.ts'

export type PendingRequest = {
  name: RuntimeHostRequestName
  resolve: (value: RuntimeHostResponseMap[RuntimeHostRequestName]) => void
  reject: (error: Error) => void
}

export type HostRole = 'service' | 'thread'

export type HostConnection = {
  id: string
  role: HostRole
  label: string
  aliases: Set<string>
  pendingRequests: Map<string, PendingRequest>
  process: ChildProcess | null
  startPromise: Promise<ChildProcess> | null
  idleTimer: ReturnType<typeof setTimeout> | null
  busy: boolean
  lastSendComposerPromptAtMs: number | null
  terminating: boolean
}

type RuntimeHostBrokerState = {
  desktopListeners: Set<(event: DesktopEvent) => void>
  hostByAlias: Map<string, HostConnection>
  hosts: Set<HostConnection>
  serviceHost: HostConnection | null
}

const THREAD_HOST_IDLE_MS = 5 * 60 * 1000
const brokerStateKey = Symbol.for('howcode.runtimeHostBrokerState')
const runtimeHostGlobal = globalThis as typeof globalThis & {
  [brokerStateKey]?: RuntimeHostBrokerState
}

if (!runtimeHostGlobal[brokerStateKey]) {
  runtimeHostGlobal[brokerStateKey] = {
    desktopListeners: new Set<(event: DesktopEvent) => void>(),
    hostByAlias: new Map<string, HostConnection>(),
    hosts: new Set<HostConnection>(),
    serviceHost: null,
  }
}

const brokerState = runtimeHostGlobal[brokerStateKey]

export const desktopListeners = brokerState.desktopListeners
export const hostByAlias = brokerState.hostByAlias
export const hosts = brokerState.hosts

let registeredHostShutdownHandlers = false
let runtimeHostsShuttingDown = false

export function isRuntimeHostsShuttingDown() {
  return runtimeHostsShuttingDown
}

export function markRuntimeHostsShuttingDown() {
  runtimeHostsShuttingDown = true
}

export function terminateHostProcess(child: ChildProcess | null | undefined) {
  if (!child || child.killed || child.exitCode !== null) return

  if (process.platform === 'win32' && child.pid) {
    const taskkill = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    taskkill.unref()
    return
  }

  child.kill('SIGTERM')
}

function killAllRuntimeHosts() {
  for (const host of hosts) {
    terminateHostProcess(host.process)
  }
}

export function registerHostShutdownHandlers() {
  if (registeredHostShutdownHandlers) return
  registeredHostShutdownHandlers = true
  process.once('exit', killAllRuntimeHosts)
  process.once('SIGTERM', () => {
    killAllRuntimeHosts()
    process.exit(0)
  })
  process.once('SIGINT', () => {
    killAllRuntimeHosts()
    process.exit(0)
  })
}

export function createHostConnection(role: HostRole, label: string): HostConnection {
  const host: HostConnection = {
    id: randomUUID(),
    role,
    label,
    aliases: new Set(),
    pendingRequests: new Map(),
    process: null,
    startPromise: null,
    idleTimer: null,
    busy: false,
    lastSendComposerPromptAtMs: null,
    terminating: false,
  }
  hosts.add(host)
  return host
}

export const serviceHost: HostConnection =
  brokerState.serviceHost ?? createHostConnection('service', 'service')
brokerState.serviceHost = serviceHost

export function rejectPendingRequests(host: HostConnection, error: Error) {
  host.busy = false
  host.lastSendComposerPromptAtMs = null
  for (const [, pending] of host.pendingRequests) {
    pending.reject(error)
  }
  host.pendingRequests.clear()
}

export function rememberHostAlias(host: HostConnection, alias: string | null | undefined) {
  if (host.terminating || !hosts.has(host)) return
  const normalized = alias?.trim()
  if (!normalized) return
  host.aliases.add(normalized)
  hostByAlias.set(normalized, host)
}

export function forgetHost(host: HostConnection) {
  host.terminating = false
  for (const alias of host.aliases) {
    if (hostByAlias.get(alias) === host) {
      hostByAlias.delete(alias)
    }
  }
  host.aliases.clear()
  host.lastSendComposerPromptAtMs = null
  if (host !== serviceHost) {
    hosts.delete(host)
  }
}

export function scheduleThreadHostIdleStop(host: HostConnection) {
  if (host.role !== 'thread' || host.pendingRequests.size > 0 || host.busy || host.terminating)
    return
  if (host.idleTimer) clearTimeout(host.idleTimer)
  host.idleTimer = setTimeout(() => {
    if (host.pendingRequests.size > 0) return
    host.terminating = true
    terminateHostProcess(host.process)
  }, THREAD_HOST_IDLE_MS)
}

export function clearHostIdleTimer(host: HostConnection) {
  if (!host.idleTimer) return
  clearTimeout(host.idleTimer)
  host.idleTimer = null
}

export function isHostRunningOrStarting(host: HostConnection) {
  return Boolean(
    !host.terminating &&
      (host.startPromise ||
        (host.process && !host.process.killed && host.process.exitCode === null)),
  )
}
