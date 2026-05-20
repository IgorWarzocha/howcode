import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import {
  getBundledSkillsPath,
  getElectronResourcesPath,
  getNodeExecutable,
  getRuntimeHostPath,
} from './client-environment.ts'
import {
  clearHostIdleTimer,
  createHostConnection,
  desktopListeners,
  forgetHost,
  type HostConnection,
  hostByAlias,
  hosts,
  isHostRunningOrStarting,
  isRuntimeHostsShuttingDown,
  markRuntimeHostsShuttingDown,
  registerHostShutdownHandlers,
  rejectPendingRequests,
  rememberHostAlias,
  scheduleThreadHostIdleStop,
  serviceHost,
  terminateHostProcess,
} from './host-connections.ts'
import { handleRuntimeHostMainRequest } from './main-request-handlers.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
} from './protocol.ts'
import { getRuntimeHostRequestSessionPath, shouldUseThreadRuntimeHost } from './request-routing.ts'

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event)
  }
}

export function shutdownRuntimeHosts() {
  markRuntimeHostsShuttingDown()

  for (const host of hosts) {
    if (host.idleTimer) {
      clearTimeout(host.idleTimer)
      host.idleTimer = null
    }
    rejectPendingRequests(host, new Error('Pi runtime host is shutting down.'))
    terminateHostProcess(host.process)
    host.process = null
    host.startPromise = null
  }

  hostByAlias.clear()
  hosts.clear()
  hosts.add(serviceHost)
}

const SERVICE_HOST_SEND_ALIAS_WINDOW_MS = 30_000

function hostOwnsRecentSendComposerPrompt(host: HostConnection) {
  return Boolean(
    [...host.pendingRequests.values()].some((pending) => pending.name === 'sendComposerPrompt') ||
      (host.lastSendComposerPromptAtMs !== null &&
        Date.now() - host.lastSendComposerPromptAtMs < SERVICE_HOST_SEND_ALIAS_WINDOW_MS),
  )
}

function handleHostDesktopEventMessage(
  host: HostConnection,
  message: Extract<RuntimeHostToMainMessage, { type: 'desktop-event' }>,
) {
  if (message.event.type === 'thread-update') {
    if (host.role === 'thread' || hostOwnsRecentSendComposerPrompt(host))
      rememberHostAlias(host, message.event.sessionPath)
    host.busy = message.event.thread.isStreaming || message.event.thread.isCompacting
    if (host.busy) clearHostIdleTimer(host)
    else scheduleThreadHostIdleStop(host)
  }
  emitDesktopEvent(message.event)
}

function getHostSendOutcome(message: Extract<RuntimeHostToMainMessage, { type: 'response' }>) {
  return message.ok &&
    typeof message.result === 'object' &&
    message.result !== null &&
    'outcome' in message.result
    ? message.result.outcome
    : null
}

function handleHostResponseMessage(
  host: HostConnection,
  message: Extract<RuntimeHostToMainMessage, { type: 'response' }>,
) {
  const pending = host.pendingRequests.get(message.id)
  if (!pending) return
  host.pendingRequests.delete(message.id)
  if (
    pending.name === 'sendComposerPrompt' &&
    (!message.ok || getHostSendOutcome(message) !== 'sent')
  ) {
    host.busy = false
  }
  scheduleThreadHostIdleStop(host)
  if (message.ok) {
    pending.resolve(message.result)
    return
  }
  const error = new Error(message.error)
  if (message.stack) error.stack = message.stack
  pending.reject(error)
}

function handleHostMessage(host: HostConnection, message: RuntimeHostToMainMessage) {
  if (!message || typeof message !== 'object') return
  if (message.type === 'desktop-event') {
    handleHostDesktopEventMessage(host, message)
    return
  }
  if (message.type === 'host-error') {
    console.error(`Pi runtime host error (${host.label})`, message.error, message.stack)
    return
  }
  if (message.type === 'main-request') {
    void handleHostMainRequest(host, message)
    return
  }
  if (message.type === 'response') handleHostResponseMessage(host, message)
}
async function handleHostMainRequest(
  host: HostConnection,
  message: Extract<RuntimeHostToMainMessage, { type: 'main-request' }>,
) {
  try {
    const result = handleRuntimeHostMainRequest(message)
    host.process?.send?.({ type: 'main-response', id: message.id, ok: true, result })
  } catch (error) {
    host.process?.send?.({
      type: 'main-response',
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

function handleHostExit(
  host: HostConnection,
  child: ChildProcess,
  code: number | null,
  signal: NodeJS.Signals | null,
) {
  if (host.process === child) host.process = null
  host.startPromise = null
  host.terminating = false
  rejectPendingRequests(
    host,
    new Error(
      `Pi runtime host ${host.label} exited${code === null ? '' : ` with code ${code}`}${signal ? ` (${signal})` : ''}.`,
    ),
  )
  if (host.role === 'thread') forgetHost(host)
}

async function ensureRuntimeHost(host: HostConnection) {
  if (isRuntimeHostsShuttingDown()) {
    throw new Error('Pi runtime host is shutting down.')
  }

  registerHostShutdownHandlers()
  if (host.terminating) {
    throw new Error(`Pi runtime host ${host.label} is stopping.`)
  }

  if (host.process && !host.process.killed && host.process.exitCode === null) {
    clearHostIdleTimer(host)
    return host.process
  }

  if (host.startPromise) {
    return host.startPromise
  }

  clearHostIdleTimer(host)
  host.startPromise = (async () => {
    const nodeExecutable = await getNodeExecutable()
    if (isRuntimeHostsShuttingDown()) {
      throw new Error('Pi runtime host is shutting down.')
    }

    return await new Promise<ChildProcess>((resolve, reject) => {
      const customPiDirectory = loadAppSettings().customPiDirectory?.trim()
      const child = spawn(nodeExecutable, [getRuntimeHostPath()], {
        cwd: getDesktopWorkingDirectory(),
        env: {
          ...process.env,
          HOWCODE_REPO_ROOT: getDesktopWorkingDirectory(),
          HOWCODE_ELECTRON_RESOURCES_PATH: getElectronResourcesPath(),
          HOWCODE_BUNDLED_SKILLS_PATH: getBundledSkillsPath(),
          ...(customPiDirectory ? { PI_CODING_AGENT_DIR: customPiDirectory } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }) as ChildProcess

      let settled = false
      const settleFailure = (error: Error) => {
        if (settled) {
          return
        }
        settled = true
        host.startPromise = null
        host.process = null
        host.terminating = false
        if (host.role === 'thread') {
          forgetHost(host)
        }
        reject(error)
      }

      child.once('spawn', () => {
        if (isRuntimeHostsShuttingDown()) {
          terminateHostProcess(child)
          settleFailure(new Error('Pi runtime host is shutting down.'))
          return
        }

        settled = true
        host.process = child
        host.startPromise = null
        resolve(child)
      })
      child.once('error', settleFailure)
      child.once('exit', (code: number | null, signal: NodeJS.Signals | null) =>
        handleHostExit(host, child, code, signal),
      )
      child.on('message', (message: unknown) =>
        handleHostMessage(host, message as RuntimeHostToMainMessage),
      )
      child.stdout?.on('data', (chunk: Buffer | string) =>
        process.stdout.write(`[pi-host:${host.label}] ${chunk}`),
      )
      child.stderr?.on('data', (chunk: Buffer | string) =>
        process.stderr.write(`[pi-host:${host.label}] ${chunk}`),
      )
    })
  })()

  return host.startPromise
}

function getHostForRequest<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  const sessionPath = getRuntimeHostRequestSessionPath(name, payload)
  if (!shouldUseThreadRuntimeHost(name, payload)) {
    return serviceHost
  }

  const existingHost = sessionPath ? hostByAlias.get(sessionPath) : null
  if (
    existingHost &&
    !existingHost.terminating &&
    (existingHost.role === 'thread' || name === 'sendComposerPrompt')
  ) {
    return existingHost
  }

  const host = createHostConnection('thread', sessionPath ?? `thread-${hosts.size}`)
  rememberHostAlias(host, sessionPath)
  return host
}

export async function invokeRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  const host = getHostForRequest(name, payload)
  const child = await ensureRuntimeHost(host)
  const id = randomUUID()

  return await new Promise<RuntimeHostResponseMap[TName]>((resolve, reject) => {
    if (name === 'sendComposerPrompt') {
      host.busy = true
      host.lastSendComposerPromptAtMs = Date.now()
      clearHostIdleTimer(host)
    }

    host.pendingRequests.set(id, {
      name,
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    })

    child.send({ type: 'request', id, name, payload }, (error) => {
      if (!error) {
        return
      }
      host.pendingRequests.delete(id)
      if (name === 'sendComposerPrompt') {
        host.busy = false
        host.lastSendComposerPromptAtMs = null
      }
      scheduleThreadHostIdleStop(host)
      reject(error)
    })
  })
}

export async function invalidateRuntimeHostSettings(
  request: {
    sessionPath?: string | undefined | null | undefined
    projectPath?: string | undefined | null | undefined
  } = {},
) {
  const targets = new Set<HostConnection>()
  if (request.sessionPath) {
    const host = hostByAlias.get(request.sessionPath)
    if (host) targets.add(host)
  } else {
    for (const host of hosts) targets.add(host)
  }

  await Promise.all(
    [...targets].filter(isHostRunningOrStarting).map((host) =>
      invokeRuntimeHostOnHost(host, 'invalidateRuntimeSettings', request).catch((error) => {
        console.warn(`Failed to invalidate Pi runtime host settings (${host.label}).`, error)
      }),
    ),
  )
}

export function restartRuntimeHostsForEnvironmentChange() {
  for (const host of hosts) {
    if (host.idleTimer) {
      clearTimeout(host.idleTimer)
      host.idleTimer = null
    }
    rejectPendingRequests(host, new Error('Pi runtime host environment changed.'))
    terminateHostProcess(host.process)
    host.process = null
    host.startPromise = null
  }

  hostByAlias.clear()
  hosts.clear()
  hosts.add(serviceHost)
}

async function invokeRuntimeHostOnHost<TName extends RuntimeHostRequestName>(
  host: HostConnection,
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  const child = await ensureRuntimeHost(host)
  const id = randomUUID()

  return await new Promise<RuntimeHostResponseMap[TName]>((resolve, reject) => {
    host.pendingRequests.set(id, {
      name,
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    })

    child.send({ type: 'request', id, name, payload }, (error) => {
      if (!error) return
      host.pendingRequests.delete(id)
      scheduleThreadHostIdleStop(host)
      reject(error)
    })
  })
}

export function subscribeRuntimeHostEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener)
  void ensureRuntimeHost(serviceHost).catch((error) => {
    console.error('Failed to start Pi runtime service host for desktop events.', error)
  })
  return () => {
    desktopListeners.delete(listener)
  }
}
