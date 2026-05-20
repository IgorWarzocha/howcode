import { loadAppSettings } from './app-settings/readers.ts'
import { getPiModule } from './pi-module.ts'
import * as piSkills from './pi-skills.ts'
import * as piThreads from './pi-threads.ts'
import * as skillCreator from './skill-creator-session.ts'
import * as terminalManager from './terminal/manager.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'

type ServiceRequest = {
  type: 'request'
  id: string
  module: string
  method: string
  args: unknown[]
}

type ServiceResponse = {
  type: 'response'
  id: string
  ok: boolean
  result?: unknown
  error?: string
  stack?: string
}

const modules: Record<string, Record<string, unknown>> = {
  piThreads,
  piSkills,
  skillCreator,
  terminalManager,
}

type ServiceModuleName = keyof typeof modules

function isServiceModuleName(value: string): value is ServiceModuleName {
  return value in modules
}

async function getServiceDiagnostics() {
  let piAgentDir: string | null = null
  try {
    const { getAgentDir } = await getPiModule()
    piAgentDir = getAgentDir()
  } catch {
    piAgentDir = null
  }

  return {
    nodeExecPath: process.execPath,
    nodeVersion: process.version,
    nodeAbi: process.versions.modules,
    cwd: process.cwd(),
    userDataPath: getDesktopUserDataPath(),
    piAgentDir,
    customPiDirectory: loadAppSettings().customPiDirectory,
  }
}

piThreads.subscribeDesktopEvents((event) => {
  process.send?.({ type: 'desktop-event', event })
})

terminalManager.subscribeTerminalEvents((event) => {
  process.send?.({ type: 'terminal-event', event })
})

async function handleRequest(message: ServiceRequest): Promise<ServiceResponse> {
  try {
    if (!isServiceModuleName(message.module)) {
      throw new Error(`Unknown desktop service module: ${message.module}`)
    }

    const targetModule = modules[message.module]
    const target = targetModule?.[message.method]
    if (typeof target !== 'function') {
      throw new Error(`Unknown desktop service method: ${message.module}.${message.method}`)
    }

    const result = await target(...message.args)
    return { type: 'response', id: message.id, ok: true, result }
  } catch (error) {
    const stack = error instanceof Error ? error.stack : undefined
    return {
      type: 'response',
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(stack ? { stack } : {}),
    }
  }
}

process.on('message', (message: ServiceRequest) => {
  if (!message || message.type !== 'request') return
  void handleRequest(message).then((response) => process.send?.(response))
})

async function shutdown() {
  await Promise.allSettled([
    piThreads.disposeDesktopRuntime?.(),
    terminalManager.closeAllTerminals?.(),
  ])
  process.exit(0)
}

process.once('disconnect', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
process.once('SIGINT', () => void shutdown())

void getServiceDiagnostics().then((diagnostics) => {
  process.send?.({ type: 'ready', diagnostics })
})
