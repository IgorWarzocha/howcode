import { app, BrowserWindow } from 'electron'
import { createHowcodeServerTransport } from '../../../desktop/server/howcode-server-transport'
import {
  type LocalHowcodeServer,
  startLocalHowcodeServer,
  stopLocalHowcodeServer,
} from '../../../desktop/server/local-howcode-server'
import type { AppTransport } from '../../../shared/app-transport'
import type {
  HowcodeEnvironment,
  HowcodeRemoteEnvironment,
  HowcodeServerConnectionState,
} from '../../../shared/howcode-server-contracts'
import { createMainWindow } from './app/create-main-window'
import { loadMainWindow } from './app/load-main-window'
import { createDesktopRequestHandlers, registerDesktopIpc } from './ipc/register-desktop-ipc'
import { getProjectRemoteEnvironmentAssignment } from './ipc/request-handlers/remote-environments'
import { applyDevViewport } from './runtime/dev-viewport'
import { configureDevtoolsRemoteDebugging, logDevtoolsRemoteDebugging } from './runtime/devtools'
import { configureDesktopEnvironment } from './runtime/environment'
import { loadDesktopRuntimeModules } from './runtime/load-desktop-runtime'
import { registerDesktopRuntimeShutdown } from './runtime/shutdown'
import {
  createExternalServerEnvironment,
  disabledEnvironment,
  getConnectionModeForEnvironment,
  localDesktopEnvironment,
  resolveHowcodeEnvironmentForRequest,
} from './server-environments'
import {
  ensureSshHowcodeServer,
  readSshHowcodeEnvironmentConfigFromEnv,
  type SshHowcodeEnvironmentConnection,
} from './ssh-howcode-environments'
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

function createHowcodeServerConnectionState({
  connected,
  descriptor = null,
  environment,
  error = null,
}: {
  connected: boolean
  descriptor?: HowcodeServerConnectionState['descriptor']
  environment: HowcodeEnvironment
  error?: string | null
}): HowcodeServerConnectionState {
  return {
    baseUrl: environment.serverUrl,
    connected,
    descriptor,
    environment,
    environmentId: environment.id,
    environmentName: environment.name,
    error,
    mode: getConnectionModeForEnvironment(environment),
  }
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
  return (await response.json()) as HowcodeServerConnectionState['descriptor']
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

  sshHowcodeServer = await ensureSshHowcodeServer(config)
  await refreshConnectedServerState(sshHowcodeServer.environment, sshHowcodeServer.baseUrl)
  return createHowcodeServerTransport({
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
  return createHowcodeServerTransport({ authToken, baseUrl })
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
        localPort: remoteEnvironment.localPort ?? 49317,
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

  sshHowcodeServer?.close()
  sshHowcodeServer = await ensureSshHowcodeServer({
    host: config.environment.sshHost,
    localPort: config.environment.localPort ?? 49317,
    remoteCommand: config.environment.remoteCommand ?? null,
    remotePort: config.environment.remotePort ?? 39317,
    token: config.token,
  })
  return sshHowcodeServer
}

function createResilientSshServerTransport(config: {
  environment: HowcodeRemoteEnvironment
  token: string
  initialBaseUrl: string
}): AppTransport {
  let transport = createHowcodeServerTransport({
    authToken: config.token,
    baseUrl: config.initialBaseUrl,
  })

  async function reconnect() {
    const connection = await ensureSavedSshRemoteEnvironment({
      environment: config.environment,
      token: config.token,
    })
    activeRemoteServer = {
      baseUrl: connection.baseUrl,
      environment: connection.environment,
      remoteEnvironmentId: config.environment.id,
      sshConfig: {
        host: config.environment.sshHost ?? config.environment.name,
        localPort: config.environment.localPort ?? 49317,
        remoteCommand: config.environment.remoteCommand ?? null,
        remotePort: config.environment.remotePort ?? 39317,
        token: config.token,
      },
    }
    activeHowcodeEnvironment = connection.environment
    transport = createHowcodeServerTransport({
      authToken: config.token,
      baseUrl: connection.baseUrl,
    })
    await refreshConnectedServerState(connection.environment, connection.baseUrl)
    return transport
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
    subscribe: (channel, listener) => transport.subscribe(channel, listener),
  }
}

async function setActiveRemoteEnvironment(config: {
  environment: HowcodeRemoteEnvironment
  baseUrl: string
  token: string
}) {
  const connection =
    config.environment.kind === 'ssh' ? await ensureSavedSshRemoteEnvironment(config) : null
  const baseUrl = connection?.baseUrl ?? config.baseUrl
  const environment =
    connection?.environment ?? createEnvironmentFromSavedRemote(config.environment, baseUrl)
  activeRemoteServer = {
    baseUrl,
    environment,
    remoteEnvironmentId: config.environment.id,
  }
  if (config.environment.kind === 'ssh') {
    activeRemoteServer.sshConfig = {
      host: config.environment.sshHost ?? config.environment.name,
      localPort: config.environment.localPort ?? 49317,
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
      : createHowcodeServerTransport({
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
    const manifest = await activeServerTransport.request('getHowcodeInstanceManifest', {})
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

function getLocalRequestEnvironment() {
  return localHowcodeServer
    ? { ...localDesktopEnvironment, serverUrl: localHowcodeServer.baseUrl }
    : disabledEnvironment
}

function resolveEnvironmentForDesktopRequest<
  K extends import('../../../shared/desktop-ipc').DesktopRequestChannel,
>(channel: K, params: import('../../../shared/desktop-ipc').DesktopRequestMap[K]['params']) {
  if (channel === 'getShellState' && localHowcodeServer) {
    return resolveHowcodeEnvironmentForRequest(getLocalRequestEnvironment(), channel, params)
  }
  const projectId = getProjectIdFromRequestParams(params)
  const sessionPath = getSessionPathFromRequestParams(params)
  if (sessionPath && isActiveRemotePath(sessionPath)) {
    return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
  }
  if (sessionPath && !isActiveRemotePath(sessionPath)) {
    return resolveHowcodeEnvironmentForRequest(getLocalRequestEnvironment(), channel, params)
  }
  if (projectId) {
    if (activeRemoteProjectIds.has(projectId)) {
      return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
    }
    const assignedRemoteId = getProjectRemoteEnvironmentAssignment(projectId)
    if (assignedRemoteId && activeRemoteServer?.remoteEnvironmentId !== assignedRemoteId) {
      throw new Error('Project is assigned to a remote environment that is not active yet.')
    }
    return resolveHowcodeEnvironmentForRequest(getLocalRequestEnvironment(), channel, params)
  }
  return resolveHowcodeEnvironmentForRequest(activeHowcodeEnvironment, channel, params)
}

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopRuntimeModules()
  const appUpdater = new AppUpdater()
  const sshServerTransport = await resolveSshServerTransport()
  const externalServerTransport = sshServerTransport ?? (await resolveExternalServerTransport())
  activeServerTransport = shouldDisableLocalServer()
    ? externalServerTransport
    : (externalServerTransport ?? (await startDesktopLocalServer(runtime, appUpdater)))
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
    (environment) =>
      environment.kind === 'local-desktop'
        ? (localHowcodeServer?.transport ?? null)
        : activeServerTransport,
    () => howcodeServerState,
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
