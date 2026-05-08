import { app, BrowserWindow } from 'electron'
import {
  type LocalHowcodeServer,
  startLocalHowcodeServer,
  stopLocalHowcodeServer,
} from '../../../desktop/server/local-howcode-server'
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
const devtoolsDebuggingPort = configureDevtoolsRemoteDebugging()

app.setName('howcode')

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
  return localHowcodeServer.transport
}

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopRuntimeModules()
  const appUpdater = new AppUpdater()
  const serverTransport = await startDesktopLocalServer(runtime, appUpdater)
  registerDesktopRuntimeShutdown(runtime)
  registerDesktopIpc(() => currentMainWindow, runtime, appUpdater, serverTransport)
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
