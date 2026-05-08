import { app, BrowserWindow } from 'electron'
import { createHowcodeServerTransport } from '../../../desktop/server/howcode-server-transport'
import {
  type LocalHowcodeServer,
  startLocalHowcodeServer,
  stopLocalHowcodeServer,
} from '../../../desktop/server/local-howcode-server'
import type { HowcodeServerConnectionState } from '../../../shared/howcode-server-contracts'
import { createMainWindow } from './app/create-main-window'
import { loadMainWindow } from './app/load-main-window'
import { createDesktopRequestHandlers, registerDesktopIpc } from './ipc/register-desktop-ipc'
import { applyDevViewport } from './runtime/dev-viewport'
import { configureDevtoolsRemoteDebugging, logDevtoolsRemoteDebugging } from './runtime/devtools'
import { configureDesktopEnvironment } from './runtime/environment'
import { loadDesktopRuntimeModules } from './runtime/load-desktop-runtime'
import { registerDesktopRuntimeShutdown } from './runtime/shutdown'
import { AppUpdater } from './updater/app-updater'

let currentMainWindow: BrowserWindow | null = null
let localHowcodeServer: LocalHowcodeServer | null = null
let howcodeServerState: HowcodeServerConnectionState = {
  baseUrl: null,
  connected: false,
  descriptor: null,
  error: null,
  mode: 'disabled',
}
const devtoolsDebuggingPort = configureDevtoolsRemoteDebugging()

app.setName('howcode')

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

async function fetchServerDescriptor(baseUrl: string) {
  const response = await fetch(new URL('/.well-known/howcode/server', baseUrl))
  if (!response.ok) {
    throw new Error(`Howcode server descriptor request failed (${response.status}).`)
  }
  return (await response.json()) as HowcodeServerConnectionState['descriptor']
}

async function refreshExternalServerState() {
  const baseUrl = getProcessEnvironmentVariable('HOWCODE_SERVER_URL')?.trim()
  if (!baseUrl) {
    howcodeServerState = {
      baseUrl: null,
      connected: false,
      descriptor: null,
      error: shouldDisableLocalServer()
        ? 'Local Howcode server is disabled and no external server is configured.'
        : null,
      mode: 'disabled',
    }
    return howcodeServerState
  }

  try {
    howcodeServerState = {
      baseUrl,
      connected: true,
      descriptor: await fetchServerDescriptor(baseUrl),
      error: null,
      mode: 'external',
    }
  } catch (error) {
    howcodeServerState = {
      baseUrl,
      connected: false,
      descriptor: null,
      error: error instanceof Error ? error.message : 'Failed to connect to Howcode server.',
      mode: 'external',
    }
  }
  return howcodeServerState
}

async function resolveExternalServerTransport(): Promise<ReturnType<
  typeof createHowcodeServerTransport
> | null> {
  const baseUrl = getProcessEnvironmentVariable('HOWCODE_SERVER_URL')?.trim()
  const authToken = getProcessEnvironmentVariable('HOWCODE_SERVER_TOKEN')?.trim()
  if (!baseUrl) {
    return null
  }
  if (!authToken) {
    throw new Error('HOWCODE_SERVER_TOKEN is required when HOWCODE_SERVER_URL is set.')
  }
  await refreshExternalServerState()
  return createHowcodeServerTransport({ authToken, baseUrl })
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
  howcodeServerState = {
    baseUrl: localHowcodeServer.baseUrl,
    connected: true,
    descriptor: await fetchServerDescriptor(localHowcodeServer.baseUrl),
    error: null,
    mode: 'local',
  }
  return localHowcodeServer.transport
}

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopRuntimeModules()
  const appUpdater = new AppUpdater()
  const externalServerTransport = await resolveExternalServerTransport()
  const serverTransport = shouldDisableLocalServer()
    ? externalServerTransport
    : (externalServerTransport ?? (await startDesktopLocalServer(runtime, appUpdater)))
  if (!serverTransport && shouldDisableLocalServer()) {
    howcodeServerState = {
      baseUrl: null,
      connected: false,
      descriptor: null,
      error: 'Local Howcode server is disabled and no external server is configured.',
      mode: 'disabled',
    }
  }
  registerDesktopRuntimeShutdown(runtime)
  registerDesktopIpc(
    () => currentMainWindow,
    runtime,
    appUpdater,
    serverTransport,
    () => howcodeServerState,
    refreshExternalServerState,
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
