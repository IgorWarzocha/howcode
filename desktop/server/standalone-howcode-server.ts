import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppTransport } from '../../shared/app-transport'
import type { DesktopRequestHandlerMap } from '../../shared/desktop-ipc'
import {
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  HOWCODE_SERVER_WS_PATH,
} from '../../shared/howcode-server-contracts'
import { createPiPackagesHandlers } from '../../src/electron/main/ipc/request-handlers/pi-packages'
import { createPiSkillsHandlers } from '../../src/electron/main/ipc/request-handlers/pi-skills'
import { createPiThreadsHandlers } from '../../src/electron/main/ipc/request-handlers/pi-threads'
import { createSkillCreatorHandlers } from '../../src/electron/main/ipc/request-handlers/skill-creator'
import { createTerminalHandlers } from '../../src/electron/main/ipc/request-handlers/terminal'
import type { DesktopRuntimeModules } from '../../src/electron/main/runtime/desktop-runtime-contracts'
import { startLocalHowcodeServer, stopLocalHowcodeServer } from './local-howcode-server'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

type CliOptions = {
  host: string
  port: number
  token: string
  runtimeRoot: string
  webRoot: string | null
}

function readFlag(args: string[], name: string) {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) {
    return inline.slice(prefix.length)
  }
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function parseOptions(args = process.argv.slice(2)): CliOptions {
  const host =
    readFlag(args, '--host') ?? getProcessEnvironmentVariable('HOWCODE_SERVER_HOST') ?? '127.0.0.1'
  const portText =
    readFlag(args, '--port') ?? getProcessEnvironmentVariable('HOWCODE_SERVER_PORT') ?? '39317'
  const token =
    readFlag(args, '--token') ??
    getProcessEnvironmentVariable('HOWCODE_SERVER_TOKEN') ??
    randomUUID()
  const runtimeRoot = getProcessEnvironmentVariable('HOWCODE_RUNTIME_ROOT') ?? process.cwd()
  const webRoot =
    readFlag(args, '--web-root') ?? getProcessEnvironmentVariable('HOWCODE_WEB_ROOT') ?? null
  const port = Number.parseInt(portText, 10)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid --port value: ${portText}`)
  }
  return { host, port, runtimeRoot, token, webRoot }
}

async function importDesktopModule<TModule>(repoRoot: string, fileName: string) {
  const modulePath = resolve(repoRoot, 'build', 'desktop', fileName)
  return (await import(pathToFileURL(modulePath).href)) as TModule
}

async function loadRuntime(repoRoot: string): Promise<DesktopRuntimeModules> {
  const [piThreads, piSkills, skillCreator, terminalManager] = await Promise.all([
    importDesktopModule<DesktopRuntimeModules['piThreads']>(repoRoot, 'pi-threads.mjs'),
    importDesktopModule<DesktopRuntimeModules['piSkills']>(repoRoot, 'pi-skills.mjs'),
    importDesktopModule<DesktopRuntimeModules['skillCreator']>(
      repoRoot,
      'skill-creator-session.mjs',
    ),
    importDesktopModule<DesktopRuntimeModules['terminalManager']>(repoRoot, 'terminal-manager.mjs'),
  ])
  return { piThreads, piSkills, skillCreator, terminalManager }
}

function createStandaloneRequestHandlers(runtime: DesktopRuntimeModules): DesktopRequestHandlerMap {
  const unsupportedDesktopHandler = () => {
    throw new Error('This desktop-only operation is unavailable in standalone server mode.')
  }
  return {
    getHowcodeServerState: unsupportedDesktopHandler,
    refreshHowcodeServerState: unsupportedDesktopHandler,
    listHowcodeRemoteEnvironments: unsupportedDesktopHandler,
    saveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    deleteHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    testHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    setActiveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    clearActiveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    getProjectRemoteEnvironmentAssignment: unsupportedDesktopHandler,
    setProjectRemoteEnvironmentAssignment: unsupportedDesktopHandler,
    getAppUpdateState: unsupportedDesktopHandler,
    checkAppUpdate: unsupportedDesktopHandler,
    installAppUpdate: unsupportedDesktopHandler,
    restartAppUpdate: unsupportedDesktopHandler,
    ...createPiThreadsHandlers(runtime.piThreads),
    ...createPiPackagesHandlers(runtime.piThreads),
    ...createPiSkillsHandlers(runtime.piSkills),
    ...createSkillCreatorHandlers(runtime.skillCreator),
    ...createTerminalHandlers(runtime.terminalManager),
    clearClipboardImages: unsupportedDesktopHandler,
    getAttachmentKindsForPaths: unsupportedDesktopHandler,
    listComposerAttachmentEntries: unsupportedDesktopHandler,
    openExternal: unsupportedDesktopHandler,
    openPath: unsupportedDesktopHandler,
    pickComposerAttachments: unsupportedDesktopHandler,
    readClipboardFilePaths: unsupportedDesktopHandler,
    readClipboardImage: unsupportedDesktopHandler,
    readClipboardSnapshot: unsupportedDesktopHandler,
    saveTextToDownloads: unsupportedDesktopHandler,
    searchComposerAttachmentEntries: unsupportedDesktopHandler,
  }
}

function createRuntimeEventTransport(
  runtime: DesktopRuntimeModules,
): Pick<AppTransport, 'subscribe'> {
  return {
    subscribe: (channel, listener) => {
      if (channel === 'desktopEvent') {
        return runtime.piThreads.subscribeDesktopEvents((event) => listener(event as never))
      }
      return runtime.terminalManager.subscribeTerminalEvents((event) => listener(event as never))
    },
  }
}

async function main() {
  const options = parseOptions()
  const runtime = await loadRuntime(options.runtimeRoot)
  const server = await startLocalHowcodeServer({
    config: {
      host: options.host,
      port: options.port,
      token: options.token,
      webRoot: options.webRoot,
    },
    eventTransport: createRuntimeEventTransport(runtime),
    handlers: createStandaloneRequestHandlers(runtime),
  })

  const descriptorUrl = new URL(HOWCODE_SERVER_DESCRIPTOR_PATH, server.baseUrl).toString()
  const webSocketUrl = new URL(HOWCODE_SERVER_WS_PATH, server.baseUrl)
  webSocketUrl.protocol = webSocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'

  console.log(
    JSON.stringify({
      authToken: server.authToken,
      baseUrl: server.baseUrl,
      descriptorUrl,
      webSocketUrl: webSocketUrl.toString(),
      webUrl: options.webRoot ? server.baseUrl : undefined,
    }),
  )

  const shutdown = async () => {
    await stopLocalHowcodeServer(server)
    await runtime.piThreads.disposeDesktopRuntime?.()
    await runtime.terminalManager.closeAllTerminals?.()
  }

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0))
  })
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0))
  })

  await new Promise(() => {
    // Keep standalone server alive until a signal shuts it down.
  })
}

if (import.meta.main) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
