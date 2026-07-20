import type { TerminalRpcRequest } from '../shared/terminal-rpc.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { getPiModule } from './pi-module.ts'
import * as piSkills from './pi-skills.ts'
import * as piThreads from './pi-threads.ts'
import * as skillCreator from './skill-creator-session.ts'
import { createTerminalRpcServer } from './terminal/rpc-server.ts'
import * as terminalManager from './terminal/runtime.ts'
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

type TerminalRpcServiceRequest = {
  type: 'terminal-rpc-request'
  message: TerminalRpcRequest
}

const modules = {
  piThreads,
  piSkills,
  skillCreator,
} satisfies Record<string, Record<string, unknown>>

type ServiceModuleName = keyof typeof modules

function isServiceModuleName(value: string): value is ServiceModuleName {
  return Object.hasOwn(modules, value)
}

function getServiceMethod(moduleName: ServiceModuleName, methodName: string) {
  const targetModule: Record<string, unknown> = modules[moduleName]
  if (!Object.hasOwn(targetModule, methodName)) return null
  const target = targetModule[methodName]
  return typeof target === 'function' ? target : null
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

const terminalRpcServerPromise = terminalManager
  .getTerminalEffectService()
  .then((service) =>
    createTerminalRpcServer(service, (message) =>
      process.send?.({ type: 'terminal-rpc-response', message }),
    ),
  )

async function handleRequest(message: ServiceRequest): Promise<ServiceResponse> {
  try {
    if (!isServiceModuleName(message.module)) {
      throw new Error(`Unknown desktop service module: ${message.module}`)
    }

    const target = getServiceMethod(message.module, message.method)
    if (!target) {
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

process.on('message', (message: ServiceRequest | TerminalRpcServiceRequest) => {
  if (message?.type === 'terminal-rpc-request') {
    void terminalRpcServerPromise.then((server) => server.write(message.message))
    return
  }
  if (message?.type === 'request') {
    void handleRequest(message).then((response) => process.send?.(response))
  }
})

async function shutdown() {
  const terminalRpcServer = await terminalRpcServerPromise
  await Promise.allSettled([
    terminalRpcServer.dispose(),
    piThreads.disposeDesktopRuntime?.(),
    terminalManager.closeAllTerminals(),
  ])
  await Promise.allSettled([terminalManager.disposeTerminalRuntime()])
  process.exit(0)
}

process.once('disconnect', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
process.once('SIGINT', () => void shutdown())

void Promise.all([getServiceDiagnostics(), terminalRpcServerPromise]).then(([diagnostics]) => {
  process.send?.({ type: 'ready', diagnostics })
})
