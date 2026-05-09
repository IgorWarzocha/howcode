import { app, type BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import type { AppTransport } from '../../../../shared/app-transport'
import { getDesktopRequestChannelOwner } from '../../../../shared/app-transport-ownership'
import {
  type DesktopRequestChannel,
  type DesktopRequestHandlerMap,
  type DesktopRequestMap,
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
} from '../../../../shared/desktop-ipc'
import { resolveConfiguredDevServerUrl } from '../../../../shared/dev-server'
import type {
  HowcodeEnvironment,
  HowcodeServerConnectionState,
} from '../../../../shared/howcode-server-contracts'
import { isTrustedRendererUrl } from '../app/navigation-security'
import { getRendererDistDirectory } from '../runtime/app-paths'
import type { DesktopRuntimeModules } from '../runtime/desktop-runtime-contracts'
import type { AppUpdater } from '../updater/app-updater'
import { createAppUpdateHandlers } from './request-handlers/app-update'
import { createInstanceManifestHandlers } from './request-handlers/instance-manifest'
import { createPiPackagesHandlers } from './request-handlers/pi-packages'
import { createPiSkillsHandlers } from './request-handlers/pi-skills'
import { createPiThreadsHandlers } from './request-handlers/pi-threads'
import {
  createRemoteEnvironmentHandlers,
  type SavedRemoteEnvironmentConnectionConfig,
} from './request-handlers/remote-environments'
import { createSkillCreatorHandlers } from './request-handlers/skill-creator'
import { createSystemHandlers } from './request-handlers/system'
import { createTerminalHandlers } from './request-handlers/terminal'

function createDisabledHowcodeServerState(): HowcodeServerConnectionState {
  return {
    attemptCount: 0,
    baseUrl: null,
    connected: false,
    closeCode: null,
    closeReason: null,
    connectedAt: null,
    descriptor: null,
    disconnectedAt: new Date().toISOString(),
    environment: {
      id: 'disabled',
      kind: 'disabled',
      name: 'No Howcode server',
      scope: 'global',
      serverUrl: null,
    },
    environmentId: 'disabled',
    environmentName: 'No Howcode server',
    error: null,
    fingerprint: null,
    lastError: null,
    lastErrorAt: null,
    mode: 'disabled',
    nextRetryAt: null,
    phase: 'disconnected',
    reconnectAttemptCount: 0,
    reconnectPhase: 'idle',
    serverKind: 'unknown',
  }
}

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getRendererTrustConfig() {
  return {
    rendererDistDirectory: getRendererDistDirectory(),
    devServerUrl: app.isPackaged
      ? null
      : resolveConfiguredDevServerUrl([
          getProcessEnvironmentVariable('HOWCODE_REPO_ROOT') ?? '',
          app.getAppPath(),
          process.cwd(),
        ]),
  }
}

function assertTrustedDesktopIpcEvent(
  event: IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null,
) {
  const mainWindow = getMainWindow()
  const senderUrl = event.senderFrame?.url || event.sender.getURL()

  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Blocked desktop IPC request from a non-main renderer.')
  }

  if (!isTrustedRendererUrl(senderUrl, getRendererTrustConfig())) {
    throw new Error(`Blocked desktop IPC request from untrusted renderer URL: ${senderUrl}`)
  }
}

function registerRequestHandlers(
  handlers: DesktopRequestHandlerMap,
  getMainWindow: () => BrowserWindow | null,
  getServerTransport: (environment: HowcodeEnvironment) => AppTransport | null,
  resolveEnvironmentForRequest: <K extends DesktopRequestChannel>(
    channel: K,
    params: DesktopRequestMap[K]['params'],
  ) => HowcodeEnvironment,
) {
  for (const channel of Object.keys(handlers) as DesktopRequestChannel[]) {
    ipcMain.handle(getDesktopRequestIpcChannel(channel), (event, params) => {
      assertTrustedDesktopIpcEvent(event, getMainWindow)
      const environment = resolveEnvironmentForRequest(channel, params)
      const owner = getDesktopRequestChannelOwner(channel)
      const routeToServer = owner === 'howcode-server' || owner === 'pi-runtime'
      if (routeToServer) {
        const serverTransport = getServerTransport(environment)
        if (!serverTransport) {
          throw new Error('Howcode server is required for this operation but is not connected.')
        }
        return serverTransport.request(channel, params)
      }
      return handlers[channel](params)
    })
  }
}

export function createDesktopRequestHandlers(
  runtime: DesktopRuntimeModules,
  appUpdater: AppUpdater,
  remoteEnvironmentOptions: {
    setActiveRemoteEnvironment?: (
      config: SavedRemoteEnvironmentConnectionConfig,
    ) => Promise<HowcodeServerConnectionState> | HowcodeServerConnectionState
    clearActiveRemoteEnvironment?: () =>
      | Promise<HowcodeServerConnectionState>
      | HowcodeServerConnectionState
  } = {},
): DesktopRequestHandlerMap {
  return {
    getHowcodeServerState: createDisabledHowcodeServerState,
    ...createRemoteEnvironmentHandlers(remoteEnvironmentOptions),
    refreshHowcodeServerState: createDisabledHowcodeServerState,
    ...createAppUpdateHandlers(appUpdater),
    ...createInstanceManifestHandlers(runtime.piThreads),
    ...createPiThreadsHandlers(runtime.piThreads),
    ...createPiPackagesHandlers(runtime.piThreads),
    ...createPiSkillsHandlers(runtime.piSkills),
    ...createSkillCreatorHandlers(runtime.skillCreator),
    ...createTerminalHandlers(runtime.terminalManager),
    ...createSystemHandlers(),
  }
}

export function registerDesktopIpc(
  getMainWindow: () => BrowserWindow | null,
  runtime: DesktopRuntimeModules,
  appUpdater: AppUpdater,
  getServerTransport: (environment: HowcodeEnvironment) => AppTransport | null = () => null,
  getHowcodeServerState: () => HowcodeServerConnectionState = createDisabledHowcodeServerState,
  refreshHowcodeServerState: () =>
    | Promise<HowcodeServerConnectionState>
    | HowcodeServerConnectionState = getHowcodeServerState,
  remoteEnvironmentOptions: {
    setActiveRemoteEnvironment?: (
      config: SavedRemoteEnvironmentConnectionConfig,
    ) => Promise<HowcodeServerConnectionState> | HowcodeServerConnectionState
    clearActiveRemoteEnvironment?: () =>
      | Promise<HowcodeServerConnectionState>
      | HowcodeServerConnectionState
  } = {},
  resolveEnvironmentForRequest: <K extends DesktopRequestChannel>(
    channel: K,
    params: DesktopRequestMap[K]['params'],
  ) => HowcodeEnvironment = () => ({
    id: 'disabled',
    kind: 'disabled',
    name: 'No Howcode server',
    scope: 'global',
    serverUrl: null,
  }),
) {
  const handlers: DesktopRequestHandlerMap = {
    ...createDesktopRequestHandlers(runtime, appUpdater, remoteEnvironmentOptions),
    getHowcodeServerState,
    refreshHowcodeServerState,
  }

  registerRequestHandlers(handlers, getMainWindow, getServerTransport, resolveEnvironmentForRequest)

  runtime.piThreads.subscribeDesktopEvents((event) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(getDesktopEventIpcChannel('desktopEvent'), event)
    }
  })

  runtime.terminalManager.subscribeTerminalEvents((event) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(getDesktopEventIpcChannel('terminalEvent'), event)
    }
  })

  appUpdater.subscribe((state) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(getDesktopEventIpcChannel('desktopEvent'), {
        type: 'app-update',
        state,
      })
    }
  })
}
