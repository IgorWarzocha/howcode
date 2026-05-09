import { existsSync } from 'node:fs'
import { app, BrowserWindow } from 'electron'
import type { HowcodeRpcClientTransport } from '../../../server/howcode-rpc-client-transport'
import { createHowcodeRpcClientTransport } from '../../../server/howcode-rpc-client-transport'
import {
  type LocalHowcodeServer,
  startLocalHowcodeServer,
  stopLocalHowcodeServer,
} from '../../../server/local-howcode-server'
import {
  createExternalServerEnvironment,
  disabledEnvironment,
  getConnectionModeForEnvironment,
  localDesktopEnvironment,
  resolveHowcodeEnvironmentForRequest,
} from '../../../server/server-environments'
import { ensureSshHowcodeEnvironmentPromise } from '../../../server/ssh/ssh-environment-manager'
import {
  readSshHowcodeEnvironmentConfigFromEnv,
  type SshHowcodeEnvironmentConnection,
} from '../../../server/ssh-howcode-environments'
import type { AppTransport } from '../../../shared/app-transport'
import {
  assertCompatibleHowcodeServerDescriptor,
  type HowcodeEnvironment,
  type HowcodeRemoteEnvironment,
  type HowcodeServerConnectionState,
} from '../../../shared/howcode-server-contracts'
import { createMainWindow } from './app/create-main-window'
import { loadMainWindow } from './app/load-main-window'
import { createDesktopRequestHandlers, registerDesktopIpc } from './ipc/register-desktop-ipc'
import {
  getProjectRemoteEnvironmentAssignment,
  readSavedRemoteEnvironmentConnectionConfig,
  readSavedRemoteEnvironmentConnectionConfigs,
} from './ipc/request-handlers/remote-environments'
import { applyDevViewport } from './runtime/dev-viewport'
import { configureDevtoolsRemoteDebugging, logDevtoolsRemoteDebugging } from './runtime/devtools'
import { configureDesktopEnvironment } from './runtime/environment'
import { loadDesktopRuntimeModules } from './runtime/load-desktop-runtime'
import { registerDesktopRuntimeShutdown } from './runtime/shutdown'
import { AppUpdater } from './updater/app-updater'

let currentMainWindow: BrowserWindow | null = null
let localHowcodeServer: LocalHowcodeServer | null = null
let sshHowcodeServer: SshHowcodeEnvironmentConnection | null = null
let activeServerTransport: AppTransport | null = null
let activeRemoteServer: {
  baseUrl: string
  environment: HowcodeEnvironment
  remoteEnvironmentId: string
  sshConfig?: {
    host: string
    localPort: number
    remoteCommand: string | null
    remotePort: number
    token: string
  }
} | null = null
let activeRemoteProjectIds = new Set<string>()
let activeRemotePathRoots = new Set<string>()
let activeHowcodeEnvironment: HowcodeEnvironment = disabledEnvironment
let activeRemoteEventUnsubscribers: Array<() => void> = []
let howcodeServerState = createHowcodeServerConnectionState({
  connected: false,
  environment: disabledEnvironment,
})
const devtoolsDebuggingPort = configureDevtoolsRemoteDebugging()
const windowsAbsolutePathPattern = /^[A-Za-z]:[/]/

app.setName('howcode')

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getPathOwnerRoot(filePath: string) {
  if (!filePath.startsWith('/')) return null
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length === 0) return null
  if ((parts[0] === 'home' || parts[0] === 'Users') && parts[1]) {
    return `/${parts[0]}/${parts[1]}`
  }
  return `/${parts[0]}`
}

function isActiveRemotePath(filePath: string | null) {
  if (!filePath) return false
  for (const root of activeRemotePathRoots) {
    if (filePath === root || filePath.startsWith(`${root}/`)) return true
  }
  return false
}

function getServerKindForEnvironment(environment: HowcodeEnvironment) {
  if (environment.kind === 'local-desktop') return 'local'
  if (environment.kind === 'external-server') return 'direct'
  if (environment.kind === 'ssh-server') {
    return environment.ssh?.serverKind === 'external' ? 'ssh-external' : 'ssh-managed'
  }
  return 'unknown'
}

function createHowcodeServerConnectionState({
  attemptCount = 1,
  connected,
  descriptor = null,
  environment,
  error = null,
  reconnectAttemptCount = 0,
  reconnectPhase = 'idle',
  serverKind,
}: {
  attemptCount?: number
  connected: boolean
  descriptor?: HowcodeServerConnectionState['descriptor']
  environment: HowcodeEnvironment
  error?: string | null
  reconnectAttemptCount?: number
  reconnectPhase?: HowcodeServerConnectionState['reconnectPhase']
  serverKind?: HowcodeServerConnectionState['serverKind']
}): HowcodeServerConnectionState {
  const now = new Date().toISOString()
  return {
    attemptCount,
    baseUrl: environment.serverUrl,
    connected,
    closeCode: null,
    closeReason: null,
    connectedAt: connected ? now : null,
    descriptor,
    disconnectedAt: connected ? null : now,
    environment,
    environmentId: environment.id,
    environmentName: environment.name,
    error,
    fingerprint: descriptor?.fingerprint ?? null,
    lastError: error,
    lastErrorAt: error ? now : null,
    mode: getConnectionModeForEnvironment(environment),
    nextRetryAt: null,
    phase: connected ? 'connected' : 'disconnected',
    reconnectAttemptCount,
    reconnectPhase,
    serverKind: serverKind ?? getServerKindForEnvironment(environment),
  }
}

function isHowcodeRpcClientTransport(
  transport: AppTransport | null,
): transport is HowcodeRpcClientTransport {
  return Boolean(
    transport &&
      'getStatus' in transport &&
      typeof (transport as { getStatus?: unknown }).getStatus === 'function',
  )
}

function getCurrentHowcodeServerState() {
  if (!isHowcodeRpcClientTransport(activeServerTransport)) return howcodeServerState
  const transportStatus = activeServerTransport.getStatus()
  return {
    ...howcodeServerState,
    attemptCount: transportStatus.attemptCount,
    connected: transportStatus.phase === 'connected' && howcodeServerState.connected,
    connectedAt: transportStatus.connectedAt ?? howcodeServerState.connectedAt,
    disconnectedAt: transportStatus.disconnectedAt ?? howcodeServerState.disconnectedAt,
    lastError: transportStatus.lastError ?? howcodeServerState.lastError,
    lastErrorAt: transportStatus.lastErrorAt ?? howcodeServerState.lastErrorAt,
    nextRetryAt: transportStatus.nextRetryAt,
    phase: transportStatus.phase,
    reconnectAttemptCount: transportStatus.reconnectAttemptCount,
    reconnectPhase: transportStatus.reconnectPhase,
  } satisfies HowcodeServerConnectionState
}

function sendDesktopEventToRenderer(event: unknown) {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    currentMainWindow.webContents.send('howcode:event:desktopEvent', event)
  }
}

function sendTerminalEventToRenderer(event: unknown) {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    currentMainWindow.webContents.send('howcode:event:terminalEvent', event)
  }
}

function stopActiveRemoteEventForwarding() {
  for (const unsubscribe of activeRemoteEventUnsubscribers) {
    unsubscribe()
  }
  activeRemoteEventUnsubscribers = []
}

function startActiveRemoteEventForwarding(transport: AppTransport) {
  stopActiveRemoteEventForwarding()
  activeRemoteEventUnsubscribers = [
    transport.subscribe('desktopEvent', sendDesktopEventToRenderer),
    transport.subscribe('terminalEvent', sendTerminalEventToRenderer),
  ]
}

async function fetchServerDescriptor(baseUrl: string) {
  const response = await fetch(new URL('/.well-known/howcode/server', baseUrl))
  if (!response.ok) {
    throw new Error(`Howcode server descriptor request failed (${response.status}).`)
  }
  const descriptor = (await response.json()) as HowcodeServerConnectionState['descriptor']
  if (!descriptor) throw new Error('Howcode server descriptor is empty.')
  assertCompatibleHowcodeServerDescriptor(descriptor)
  return descriptor
}

async function fetchServerDescriptorWithRetry(baseUrl: string, attempts = 20) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchServerDescriptor(baseUrl)
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Howcode server did not become ready.')
}

async function requestRemoteInstanceManifestWithRetry(transport: AppTransport, attempts = 20) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await transport.request('getHowcodeInstanceManifest', {})
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Howcode server manifest did not become ready.')
}

async function refreshConnectedServerState(environment: HowcodeEnvironment, baseUrl: string) {
  activeHowcodeEnvironment = environment
  try {
    howcodeServerState = createHowcodeServerConnectionState({
      connected: true,
      descriptor: await fetchServerDescriptor(baseUrl),
      environment,
    })
  } catch (error) {
    howcodeServerState = createHowcodeServerConnectionState({
      connected: false,
      environment,
      error: error instanceof Error ? error.message : 'Failed to connect to Howcode server.',
    })
  }
  return howcodeServerState
}

async function resolveSshServerTransport(): Promise<AppTransport | null> {
  const config = readSshHowcodeEnvironmentConfigFromEnv()
  if (!config) return null

  sshHowcodeServer = await ensureSshHowcodeEnvironmentPromise(config)
  await refreshConnectedServerState(sshHowcodeServer.environment, sshHowcodeServer.baseUrl)
  return createHowcodeRpcClientTransport({
    authToken: sshHowcodeServer.token,
    baseUrl: sshHowcodeServer.baseUrl,
  })
}

async function refreshActiveServerState() {
  if (activeRemoteServer) {
    return await refreshConnectedServerState(
      activeRemoteServer.environment,
      activeRemoteServer.baseUrl,
    )
  }
  return await refreshConfiguredExternalServerState()
}

async function refreshConfiguredExternalServerState() {
  const baseUrl = getProcessEnvironmentVariable('HOWCODE_SERVER_URL')?.trim()
  if (!baseUrl) {
    activeHowcodeEnvironment = disabledEnvironment
    howcodeServerState = createHowcodeServerConnectionState({
      connected: false,
      environment: disabledEnvironment,
      error: shouldDisableLocalServer()
        ? 'Local Howcode server is disabled and no external server is configured.'
        : null,
    })
    return howcodeServerState
  }

  try {
    activeHowcodeEnvironment = createExternalServerEnvironment(baseUrl)
    howcodeServerState = createHowcodeServerConnectionState({
      connected: true,
      descriptor: await fetchServerDescriptor(baseUrl),
      environment: activeHowcodeEnvironment,
    })
  } catch (error) {
    activeHowcodeEnvironment = createExternalServerEnvironment(baseUrl)
    howcodeServerState = createHowcodeServerConnectionState({
      connected: false,
      environment: activeHowcodeEnvironment,
      error: error instanceof Error ? error.message : 'Failed to connect to Howcode server.',
    })
  }
  return howcodeServerState
}

async function resolveExternalServerTransport(): Promise<AppTransport | null> {
  const baseUrl = getProcessEnvironmentVariable('HOWCODE_SERVER_URL')?.trim()
  const authToken = getProcessEnvironmentVariable('HOWCODE_SERVER_TOKEN')?.trim()
  if (!baseUrl) {
    return null
  }
  if (!authToken) {
    throw new Error('HOWCODE_SERVER_TOKEN is required when HOWCODE_SERVER_URL is set.')
  }
  await refreshConfiguredExternalServerState()
  return createHowcodeRpcClientTransport({ authToken, baseUrl })
}

function createEnvironmentFromSavedRemote(
  remoteEnvironment: HowcodeRemoteEnvironment,
  baseUrl: string,
): HowcodeEnvironment {
  if (remoteEnvironment.kind === 'ssh') {
    return {
      id: `remote:${remoteEnvironment.id}`,
      kind: 'ssh-server',
      name: remoteEnvironment.name,
      scope: 'global',
      serverUrl: baseUrl,
      ssh: {
        host: remoteEnvironment.sshHost ?? remoteEnvironment.name,
        localPort: remoteEnvironment.localPort ?? 0,
        remotePort: remoteEnvironment.remotePort ?? 39317,
      },
    }
  }

  return {
    id: `remote:${remoteEnvironment.id}`,
    kind: 'external-server',
    name: remoteEnvironment.name,
    scope: 'global',
    serverUrl: baseUrl,
  }
}

async function ensureSavedSshRemoteEnvironment(config: {
  environment: HowcodeRemoteEnvironment
  token: string
}) {
  if (!config.environment.sshHost) {
    throw new Error('SSH host alias is required.')
  }

  const previousConnection = sshHowcodeServer
  const nextConnection = await ensureSshHowcodeEnvironmentPromise({
    host: config.environment.sshHost,
    localPort: 0,
    remoteCommand: config.environment.remoteCommand ?? null,
    remotePort: config.environment.remotePort ?? 39317,
    token: config.token,
  })
  sshHowcodeServer = nextConnection
  if (previousConnection && previousConnection.baseUrl !== nextConnection.baseUrl) {
    previousConnection.close()
  }
  return sshHowcodeServer
}

function createResilientSshServerTransport(config: {
  environment: HowcodeRemoteEnvironment
  token: string
  initialBaseUrl: string
}): AppTransport {
  let transport = createHowcodeRpcClientTransport({
    authToken: config.token,
    baseUrl: config.initialBaseUrl,
  })
  let reconnectPromise: Promise<AppTransport> | null = null
  const subscriptions = new Map<
    string,
    {
      channel: Parameters<AppTransport['subscribe']>[0]
      listener: (event: never) => void
      unsubscribe: () => void
    }
  >()

  function bindSubscription(id: string) {
    const subscription = subscriptions.get(id)
    if (!subscription) return
    subscription.unsubscribe()
    subscription.unsubscribe = transport.subscribe(
      subscription.channel as never,
      subscription.listener,
    )
  }

  function rebindSubscriptions() {
    for (const id of subscriptions.keys()) bindSubscription(id)
    startActiveRemoteEventForwarding(transport)
  }

  async function createReplacementTransport() {
    const connection = await ensureSavedSshRemoteEnvironment({
      environment: config.environment,
      token: config.token,
    })
    const environment = {
      ...connection.environment,
      id: `remote:${config.environment.id}`,
      name: config.environment.name,
      serverUrl: connection.baseUrl,
    }
    activeRemoteServer = {
      baseUrl: connection.baseUrl,
      environment,
      remoteEnvironmentId: config.environment.id,
      sshConfig: {
        host: config.environment.sshHost ?? config.environment.name,
        localPort: connection.environment.ssh?.localPort ?? config.environment.localPort ?? 0,
        remoteCommand: config.environment.remoteCommand ?? null,
        remotePort:
          connection.environment.ssh?.remotePort ?? config.environment.remotePort ?? 39317,
        token: config.token,
      },
    }
    activeHowcodeEnvironment = environment
    transport = createHowcodeRpcClientTransport({
      authToken: config.token,
      baseUrl: connection.baseUrl,
    })
    await refreshConnectedServerState(environment, connection.baseUrl)
    rebindSubscriptions()
    return transport
  }

  async function reconnect() {
    reconnectPromise ??= createReplacementTransport().finally(() => {
      reconnectPromise = null
    })
    return await reconnectPromise
  }

  return {
    request: async (channel, params) => {
      try {
        return await transport.request(channel, params)
      } catch (error) {
        if (!activeRemoteServer?.sshConfig) throw error
        return await (await reconnect()).request(channel, params)
      }
    },
    subscribe: (channel, listener) => {
      const id = crypto.randomUUID()
      const subscription = {
        channel,
        listener,
        unsubscribe: () => {
          // Assigned by bindSubscription immediately after registration.
        },
      }
      subscriptions.set(id, subscription)
      bindSubscription(id)
      return () => {
        subscriptions.get(id)?.unsubscribe()
        subscriptions.delete(id)
      }
    },
  }
}

async function refreshAlreadyActiveRemoteEnvironment(remoteEnvironmentId: string) {
  if (activeRemoteServer?.remoteEnvironmentId !== remoteEnvironmentId || !activeServerTransport) {
    return null
  }
  return await refreshConnectedServerState(
    activeRemoteServer.environment,
    activeRemoteServer.baseUrl,
  )
}

async function setActiveRemoteEnvironment(config: {
  environment: HowcodeRemoteEnvironment
  baseUrl: string
  token: string
}) {
  const alreadyActiveState = await refreshAlreadyActiveRemoteEnvironment(config.environment.id)
  if (alreadyActiveState) return alreadyActiveState

  const connection =
    config.environment.kind === 'ssh' ? await ensureSavedSshRemoteEnvironment(config) : null
  const baseUrl = connection?.baseUrl ?? config.baseUrl
  const environment = connection
    ? {
        ...connection.environment,
        id: `remote:${config.environment.id}`,
        name: config.environment.name,
        serverUrl: baseUrl,
      }
    : createEnvironmentFromSavedRemote(config.environment, baseUrl)
  activeRemoteServer = {
    baseUrl,
    environment,
    remoteEnvironmentId: config.environment.id,
  }
  if (config.environment.kind === 'ssh') {
    activeRemoteServer.sshConfig = {
      host: config.environment.sshHost ?? config.environment.name,
      localPort: environment.ssh?.localPort ?? config.environment.localPort ?? 0,
      remoteCommand: config.environment.remoteCommand ?? null,
      remotePort: config.environment.remotePort ?? 39317,
      token: config.token,
    }
  }
  activeServerTransport =
    config.environment.kind === 'ssh'
      ? createResilientSshServerTransport({
          environment: config.environment,
          initialBaseUrl: baseUrl,
          token: config.token,
        })
      : createHowcodeRpcClientTransport({
          authToken: config.token,
          baseUrl,
        })
  startActiveRemoteEventForwarding(activeServerTransport)
  activeRemoteProjectIds = new Set()
  activeRemotePathRoots = new Set()

  try {
    const descriptor =
      config.environment.kind === 'ssh'
        ? await fetchServerDescriptorWithRetry(baseUrl)
        : await fetchServerDescriptor(baseUrl)
    const manifest = await requestRemoteInstanceManifestWithRetry(
      activeServerTransport,
      config.environment.kind === 'ssh' ? 40 : 8,
    )
    activeRemoteProjectIds = new Set(manifest.projects.map((project) => project.id))
    activeRemotePathRoots = new Set(
      manifest.projects
        .map((project) => getPathOwnerRoot(project.id))
        .filter((root) => root !== null),
    )
    howcodeServerState = createHowcodeServerConnectionState({
      connected: true,
      descriptor,
      environment,
    })
  } catch (error) {
    howcodeServerState = createHowcodeServerConnectionState({
      connected: false,
      environment,
      error: error instanceof Error ? error.message : 'Failed to connect to Howcode server.',
    })
  }
  activeHowcodeEnvironment = environment
  return howcodeServerState
}

async function clearActiveRemoteEnvironment() {
  stopActiveRemoteEventForwarding()
  sshHowcodeServer?.close()
  sshHowcodeServer = null
  activeRemoteProjectIds = new Set()
  activeRemotePathRoots = new Set()
  activeRemoteServer = null
  activeServerTransport = localHowcodeServer?.transport ?? null
  if (localHowcodeServer) {
    activeHowcodeEnvironment = {
      ...localDesktopEnvironment,
      serverUrl: localHowcodeServer.baseUrl,
    }
    return await refreshConnectedServerState(activeHowcodeEnvironment, localHowcodeServer.baseUrl)
  }
  activeHowcodeEnvironment = disabledEnvironment
  howcodeServerState = createHowcodeServerConnectionState({
    connected: false,
    environment: disabledEnvironment,
    error: shouldDisableLocalServer() ? 'No active Howcode server.' : null,
  })
  return howcodeServerState
}

function shouldDisableLocalServer() {
  return getProcessEnvironmentVariable('HOWCODE_DISABLE_LOCAL_SERVER') === '1'
}

async function openMainWindow() {
  const mainWindow = createMainWindow()
  currentMainWindow = mainWindow
  mainWindow.on('closed', () => {
    if (currentMainWindow === mainWindow) {
      currentMainWindow = null
    }
  })

  await loadMainWindow(mainWindow)
  await applyDevViewport(mainWindow)
  return mainWindow
}

async function startDesktopLocalServer(
  runtime: Awaited<ReturnType<typeof loadDesktopRuntimeModules>>,
  appUpdater: AppUpdater,
) {
  localHowcodeServer = await startLocalHowcodeServer({
    handlers: createDesktopRequestHandlers(runtime, appUpdater),
    eventTransport: {
      subscribe: (channel, listener) => {
        if (channel === 'desktopEvent') {
          return runtime.piThreads.subscribeDesktopEvents((event) => listener(event as never))
        }
        return runtime.terminalManager.subscribeTerminalEvents((event) => listener(event as never))
      },
    },
  })
  activeHowcodeEnvironment = {
    ...localDesktopEnvironment,
    serverUrl: localHowcodeServer.baseUrl,
  }
  howcodeServerState = createHowcodeServerConnectionState({
    connected: true,
    descriptor: await fetchServerDescriptor(localHowcodeServer.baseUrl),
    environment: activeHowcodeEnvironment,
  })
  return localHowcodeServer.transport
}

function getProjectIdFromRequestParams(params: unknown) {
  return params &&
    typeof params === 'object' &&
    'projectId' in params &&
    typeof params.projectId === 'string'
    ? params.projectId
    : params &&
        typeof params === 'object' &&
        'payload' in params &&
        params.payload &&
        typeof params.payload === 'object' &&
        'projectId' in params.payload &&
        typeof params.payload.projectId === 'string'
      ? params.payload.projectId
      : null
}

function getSessionPathFromRequestParams(params: unknown) {
  return params &&
    typeof params === 'object' &&
    'sessionPath' in params &&
    typeof params.sessionPath === 'string'
    ? params.sessionPath
    : params &&
        typeof params === 'object' &&
        'payload' in params &&
        params.payload &&
        typeof params.payload === 'object' &&
        'sessionPath' in params.payload &&
        typeof params.payload.sessionPath === 'string'
      ? params.payload.sessionPath
      : null
}

function getEnvironmentIdFromRequestParams(params: unknown) {
  return params &&
    typeof params === 'object' &&
    'environmentId' in params &&
    typeof params.environmentId === 'string'
    ? params.environmentId
    : params &&
        typeof params === 'object' &&
        'payload' in params &&
        params.payload &&
        typeof params.payload === 'object' &&
        'environmentId' in params.payload &&
        typeof params.payload.environmentId === 'string'
      ? params.payload.environmentId
      : null
}

function isAbsolutePath(value: string) {
  return value.startsWith('/') || windowsAbsolutePathPattern.test(value)
}

function isLocalPath(value: string) {
  return !isAbsolutePath(value) || existsSync(value)
}

function getProjectPathFromPersistedSessionPath(sessionPath: string | null) {
  if (!sessionPath) return null
  const marker = '/sessions/--'
  const markerIndex = sessionPath.indexOf(marker)
  if (markerIndex < 0) return null
  const encodedProjectPath = sessionPath.slice(markerIndex + marker.length).split('--')[0]
  if (!encodedProjectPath) return null
  return `/${encodedProjectPath.replaceAll('-', '/')}`
}

function getLocalRequestEnvironment() {
  return localHowcodeServer
    ? { ...localDesktopEnvironment, serverUrl: localHowcodeServer.baseUrl }
    : disabledEnvironment
}

function normalizeRemoteEnvironmentId(environmentId: string) {
  return environmentId.startsWith('remote:') ? environmentId.slice('remote:'.length) : environmentId
}

async function activateSavedRemoteEnvironment(environmentId: string) {
  const normalizedEnvironmentId = normalizeRemoteEnvironmentId(environmentId)
  const config = readSavedRemoteEnvironmentConnectionConfig(normalizedEnvironmentId)
  if ('error' in config) throw new Error(config.error)
  await setActiveRemoteEnvironment(config)
  if (activeRemoteServer?.remoteEnvironmentId !== normalizedEnvironmentId) {
    throw new Error('Remote environment activation did not complete.')
  }
  return activeHowcodeEnvironment
}

async function activateSingleSavedRemoteForPath(pathKind: 'Project' | 'Session') {
  if (activeRemoteServer) return activeHowcodeEnvironment
  const savedRemotes = readSavedRemoteEnvironmentConnectionConfigs()
  const onlySavedRemote = savedRemotes[0] ?? null
  if (onlySavedRemote && savedRemotes.length === 1) {
    return await activateSavedRemoteEnvironment(onlySavedRemote.environment.id)
  }
  if (savedRemotes.length > 1) {
    throw new Error(
      `${pathKind} belongs to a non-local path. Assign the project to a remote environment before running it.`,
    )
  }
  throw new Error(
    `${pathKind} belongs to a non-local path, but no remote environment is configured.`,
  )
}

async function resolveExplicitEnvironment(environmentId: string) {
  const normalizedEnvironmentId = normalizeRemoteEnvironmentId(environmentId)
  if (activeRemoteServer?.remoteEnvironmentId === normalizedEnvironmentId)
    return activeHowcodeEnvironment
  return await activateSavedRemoteEnvironment(normalizedEnvironmentId)
}

async function resolveProjectEnvironment(projectId: string) {
  if (activeRemoteProjectIds.has(projectId) || isActiveRemotePath(projectId)) {
    return activeHowcodeEnvironment
  }
  if (isAbsolutePath(projectId) && !isLocalPath(projectId)) {
    return await activateSingleSavedRemoteForPath('Project')
  }
  const assignedRemoteId = getProjectRemoteEnvironmentAssignment(projectId)
  if (assignedRemoteId && activeRemoteServer?.remoteEnvironmentId === assignedRemoteId) {
    return activeHowcodeEnvironment
  }
  if (assignedRemoteId) {
    return await activateSavedRemoteEnvironment(assignedRemoteId)
  }
  return getLocalRequestEnvironment()
}

async function resolveEnvironmentForDesktopRequest<
  K extends import('../../../shared/desktop-ipc').DesktopRequestChannel,
>(channel: K, params: import('../../../shared/desktop-ipc').DesktopRequestMap[K]['params']) {
  if (channel === 'getShellState' && localHowcodeServer) {
    return resolveHowcodeEnvironmentForRequest(getLocalRequestEnvironment(), channel, params)
  }
  const projectId = getProjectIdFromRequestParams(params)
  const sessionPath = getSessionPathFromRequestParams(params)
  const environmentId = getEnvironmentIdFromRequestParams(params)
  if (environmentId) {
    return resolveHowcodeEnvironmentForRequest(
      await resolveExplicitEnvironment(environmentId),
      channel,
      params,
    )
  }
  const sessionProjectPath = getProjectPathFromPersistedSessionPath(sessionPath)
  if (sessionProjectPath && isActiveRemotePath(sessionProjectPath)) {
    return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
  }
  if (
    sessionProjectPath &&
    isAbsolutePath(sessionProjectPath) &&
    !isLocalPath(sessionProjectPath)
  ) {
    return resolveHowcodeEnvironmentForRequest(
      await activateSingleSavedRemoteForPath('Session'),
      channel,
      params,
    )
  }
  if (sessionPath && isActiveRemotePath(sessionPath)) {
    return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
  }
  if (sessionPath && isAbsolutePath(sessionPath) && !isLocalPath(sessionPath)) {
    return resolveHowcodeEnvironmentForRequest(
      await activateSingleSavedRemoteForPath('Session'),
      channel,
      params,
    )
  }
  if (sessionPath && !isActiveRemotePath(sessionPath)) {
    return resolveHowcodeEnvironmentForRequest(getLocalRequestEnvironment(), channel, params)
  }
  if (projectId) {
    return resolveHowcodeEnvironmentForRequest(
      await resolveProjectEnvironment(projectId),
      channel,
      params,
    )
  }
  return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
}

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopRuntimeModules()
  const appUpdater = new AppUpdater()
  if (!shouldDisableLocalServer()) {
    await startDesktopLocalServer(runtime, appUpdater)
  }
  const sshServerTransport = await resolveSshServerTransport()
  const externalServerTransport = sshServerTransport ?? (await resolveExternalServerTransport())
  activeServerTransport = externalServerTransport ?? localHowcodeServer?.transport ?? null
  if (!activeServerTransport && shouldDisableLocalServer()) {
    activeHowcodeEnvironment = disabledEnvironment
    howcodeServerState = createHowcodeServerConnectionState({
      connected: false,
      environment: disabledEnvironment,
      error: 'Local Howcode server is disabled and no external server is configured.',
    })
  }
  registerDesktopRuntimeShutdown(runtime)
  registerDesktopIpc(
    () => currentMainWindow,
    runtime,
    appUpdater,
    (environment) => {
      if (environment.kind === 'local-desktop') return localHowcodeServer?.transport ?? null
      return environment.id === activeRemoteServer?.environment.id ||
        environment.id === activeHowcodeEnvironment.id
        ? activeServerTransport
        : null
    },
    getCurrentHowcodeServerState,
    refreshActiveServerState,
    {
      clearActiveRemoteEnvironment,
      setActiveRemoteEnvironment,
    },
    resolveEnvironmentForDesktopRequest,
  )
  await openMainWindow()
  void appUpdater.checkForUpdate()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await openMainWindow()
    }
  })
}

app.on('before-quit', () => {
  sshHowcodeServer?.close()
  void stopLocalHowcodeServer(localHowcodeServer)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

void bootstrap().catch((error) => {
  console.error('Failed to bootstrap Electron app.', error)
  app.quit()
})
