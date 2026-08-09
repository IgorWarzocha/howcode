import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import {
  type DesktopServiceRemoteModuleName,
  type DesktopServiceRemoteRuntime,
  desktopServiceRemoteMethods,
} from '../shared/desktop-service-rpc.ts'
import { makeShutdownCoordinator } from '../shared/effect-shutdown.ts'
import type { TerminalRpcRequest } from '../shared/terminal-rpc.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { getPiModule } from './pi-module.ts'
import * as piSkills from './pi-skills.ts'
import * as piThreads from './pi-threads.ts'
import { createTerminalRpcServer } from './terminal/rpc-server.ts'
import * as terminalManager from './terminal/runtime.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'

const ServiceRequestSchema = Schema.Struct({
  type: Schema.Literal('request'),
  id: Schema.String,
  module: Schema.Literals(['piThreads', 'piSkills']),
  method: Schema.String,
  args: Schema.mutable(Schema.Array(Schema.Unknown)),
})

type ServiceRequest = typeof ServiceRequestSchema.Type

type ServiceResponse = {
  type: 'response'
  id: string
  ok: boolean
  result?: unknown
  error?: string
  stack?: string
}

const ServiceInboundMessageSchema = Schema.Union([
  ServiceRequestSchema,
  Schema.Struct({ type: Schema.Literal('terminal-rpc-request'), message: Schema.Unknown }),
])

const decodeServiceInboundMessage = Schema.decodeUnknownResult(ServiceInboundMessageSchema)

const modules = {
  piThreads,
  piSkills,
} satisfies DesktopServiceRemoteRuntime

function isServiceModuleName(value: string): value is DesktopServiceRemoteModuleName {
  return Object.hasOwn(modules, value)
}

function getServiceMethod(moduleName: DesktopServiceRemoteModuleName, methodName: string) {
  if (!Object.hasOwn(desktopServiceRemoteMethods[moduleName], methodName)) return null
  const targetModule: Record<string, unknown> = modules[moduleName]
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

process.on('message', (message: unknown) => {
  const decoded = decodeServiceInboundMessage(message)
  if (Result.isFailure(decoded)) {
    console.warn('Ignored invalid desktop service request.', decoded.failure)
    return
  }
  const inbound = decoded.success
  if (inbound.type === 'terminal-rpc-request') {
    void terminalRpcServerPromise.then((server) =>
      server.write(inbound.message as TerminalRpcRequest),
    )
    return
  }
  void handleRequest(inbound).then((response) => process.send?.(response))
})

function settledTask<A>(evaluate: () => A) {
  return Effect.exit(Effect.promise(async () => await evaluate())).pipe(Effect.asVoid)
}

const shutdownCoordinatorPromise = Effect.runPromise(
  makeShutdownCoordinator(
    Effect.gen(function* () {
      const terminalRpcServer = yield* Effect.option(
        Effect.tryPromise({
          try: () => terminalRpcServerPromise,
          catch: (error) => error,
        }),
      )
      yield* Effect.all(
        [
          Option.isSome(terminalRpcServer)
            ? settledTask(() => terminalRpcServer.value.dispose())
            : Effect.void,
          settledTask(() => piThreads.disposeDesktopRuntime?.()),
          settledTask(() => terminalManager.closeAllTerminals()),
        ],
        { concurrency: 'unbounded', discard: true },
      )
      yield* settledTask(() => terminalManager.disposeTerminalRuntime())
    }),
    { label: 'Desktop service', timeout: '2 seconds' },
  ),
)

function requestShutdown() {
  void shutdownCoordinatorPromise
    .then((coordinator) => Effect.runPromise(coordinator.shutdown))
    .finally(() => process.exit(0))
}

process.once('disconnect', requestShutdown)
process.once('SIGTERM', requestShutdown)
process.once('SIGINT', requestShutdown)

void Promise.all([getServiceDiagnostics(), terminalRpcServerPromise]).then(([diagnostics]) => {
  process.send?.({ type: 'ready', diagnostics })
})
