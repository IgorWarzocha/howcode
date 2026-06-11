import { app, BrowserWindow } from 'electron'
import { installApplicationMenu } from './app/application-menu'
import { createMainWindow } from './app/create-main-window'
import { loadMainWindow } from './app/load-main-window'
import { getHeadlessAccessUrl, parseHeadlessServerOptions } from './headless/options'
import { startHeadlessServer } from './headless/server'
import { registerDesktopIpc } from './ipc/register-desktop-ipc'
import { applyDevViewport } from './runtime/dev-viewport'
import { configureDevtoolsRemoteDebugging, logDevtoolsRemoteDebugging } from './runtime/devtools'
import { configureDesktopEnvironment } from './runtime/environment'
import { loadDesktopServiceRuntime } from './runtime/load-desktop-runtime'
import { registerDesktopRuntimeShutdown } from './runtime/shutdown'
import { AppUpdater } from './updater/app-updater'

let currentMainWindow: BrowserWindow | null = null
let quitRequested = false
const headlessOptions = parseHeadlessServerOptions()
const devtoolsDebuggingPort = configureDevtoolsRemoteDebugging()

if (headlessOptions.enabled) {
  app.commandLine.removeSwitch('headless')
  app.commandLine.appendSwitch('disable-gpu')
}

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

async function bootstrap() {
  await app.whenReady()
  configureDesktopEnvironment()
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort)

  const runtime = await loadDesktopServiceRuntime()
  const appUpdater = new AppUpdater(async () => {
    const appSettings = await runtime.piThreads.loadAppSettings()
    return appSettings.devUpdateBranch ? 'dev' : 'main'
  })
  const installMenu = () =>
    installApplicationMenu({ getMainWindow: () => currentMainWindow, piThreads: runtime.piThreads })
  registerDesktopRuntimeShutdown(runtime)

  if (headlessOptions.enabled) {
    const server = await startHeadlessServer({
      runtime,
      appUpdater,
      options: headlessOptions,
    })
    app.once('before-quit', () => server.close())
    console.log(`Howcode headless listening on ${getHeadlessAccessUrl(headlessOptions)}`)
    if (headlessOptions.host === '0.0.0.0' || headlessOptions.host === '::') {
      console.warn(
        'Howcode headless is reachable from other devices. Keep it on a trusted network.',
      )
    }
    return
  }

  registerDesktopIpc(() => currentMainWindow, runtime, appUpdater, installMenu)
  await installMenu()
  await openMainWindow()
  void appUpdater.checkForUpdate()

  app.on('activate', async () => {
    if (quitRequested) {
      return
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      await openMainWindow()
    }
  })
}

app.on('before-quit', () => {
  quitRequested = true
})

app.on('window-all-closed', () => {
  if (headlessOptions.enabled) {
    return
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

void bootstrap().catch((error) => {
  console.error('Failed to bootstrap Electron app.', error)
  app.quit()
})
