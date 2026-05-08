import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import { app, BrowserWindow } from 'electron'
import {
  type HowcodeServerHandle,
  startHowcodeServer,
} from '../../../desktop/server/howcode-server'
import { createHowcodeServerTransport } from '../../../desktop/server/howcode-server-transport'
import type { AppTransport } from '../../../shared/app-transport'
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
let localHowcodeServer: HowcodeServerHandle | null = null
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

function createDirectHandlerTransport(
  handlers: ReturnType<typeof createDesktopRequestHandlers>,
): AppTransport {
  return {
    request: async (channel, params) => await handlers[channel](params),
    subscribe: () => {
      throw new Error('Direct Howcode server event subscriptions are not implemented yet.')
    },
  }
}

async function startLocalHowcodeServer(
  runtime: Awaited<ReturnType<typeof loadDesktopRuntimeModules>>,
  appUpdater: AppUpdater,
) {
  const handlers = createDesktopRequestHandlers(runtime, appUpdater)
  const handle = await Effect.runPromise(
    startHowcodeServer(
      {
        host: '127.0.0.1',
        port: 0,
        authToken: randomUUID(),
      },
      createDirectHandlerTransport(handlers),
    ),
  )
  localHowcodeServer = handle
  return createHowcodeServerTransport({
    authToken: handle.authToken,
    baseUrl: `http://${handle.address.host}:${handle.address.port}`,
  })
}

async function stopLocalHowcodeServer() {
  const handle = localHowcodeServer
  localHowcodeServer = null
  if (!handle) {
    return
  }
  await Effect.runPromise(Effect.catch(handle.close, () => Effect.void))
}

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopRuntimeModules()
  const appUpdater = new AppUpdater()
  const serverTransport = await startLocalHowcodeServer(runtime, appUpdater)
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
  void stopLocalHowcodeServer()
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
