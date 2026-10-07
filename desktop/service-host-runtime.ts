import * as Effect from 'effect/Effect'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import * as artifacts from '../components/artifacts/service/index.ts'
import { artifactsDatabaseSchema } from '../components/artifacts/service/schema.ts'
import {
  cleanupLegacyCheckpoints,
  createCodingService,
} from '../components/coding/service/index.ts'
import { codingDatabaseSchema } from '../components/coding/service/schema.ts'
import { codingThreadBranchFallbacks } from '../components/coding/service/state.ts'
import { createDictationService } from '../components/dictation/service/index.ts'
import { createPackageUiService } from '../components/packages/service/index.ts'
import { createSkillsService } from '../components/skills/service/index.ts'
import * as terminalManager from '../components/terminal/service/index.ts'
import { createTerminalServiceComponent } from '../components/terminal/service/index.ts'
import {
  type DesktopServiceRemoteModuleName,
  type DesktopServiceRemoteRuntime,
  desktopServiceRemoteMethods,
} from '../shared/desktop-service-rpc.ts'
import { desktopShutdownTimeouts } from '../shared/desktop-shutdown-deadlines.ts'
import { makeShutdownCoordinator } from '../shared/effect-shutdown.ts'
import type { TerminalRpcRequest } from '../shared/terminal-rpc.ts'
import { registerConversationCleanup } from './app-service/thread-actions.ts'
import * as coreApp from './app-service.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { emitDesktopEvent } from './runtime/desktop-events.ts'
import { getAgentDirectory } from './settings/paths.ts'
import {
  configureDatabaseSchemas,
  disposeThreadStateDatabase,
  registerDatabaseStartupTask,
} from './thread-state-db/db.ts'
import { registerThreadBranchFallbacks } from './thread-state-db/thread-branch-fallbacks.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'

const ServiceRequestSchema = Schema.Struct({
  type: Schema.Literal('request'),
  id: Schema.String,
  module: Schema.Literals(['app', 'skills', 'coding', 'artifacts', 'dictation', 'packages']),
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

configureDatabaseSchemas([codingDatabaseSchema, artifactsDatabaseSchema])

const skillsComponent = createSkillsService()
const packagesComponent = await createPackageUiService(
  { directory: getDesktopUserDataPath(), cwd: process.cwd() },
  () => emitDesktopEvent({ type: 'package-ui-invalidation' }),
)
const packages = packagesComponent.service
const skills = skillsComponent.service
const dictationComponent = createDictationService()
const dictation = dictationComponent.service
const codingComponent = createCodingService({
  deleteArtifactsForConversations: artifacts.deleteArtifactsForConversations,
  listTerminals: terminalManager.listTerminals,
  closeWorkspaceTerminals: terminalManager.closeWorkspaceTerminals,
  hasActiveWorkspaceTerminal: terminalManager.hasActiveWorkspaceTerminal,
})
const coding = codingComponent.service
const unregisterArtifactCleanup = registerConversationCleanup(
  artifacts.deleteArtifactsForConversation,
)
const unregisterCodingBranchFallbacks = registerThreadBranchFallbacks(codingThreadBranchFallbacks)
const unregisterCodingMigration = registerDatabaseStartupTask(cleanupLegacyCheckpoints())
const app = {
  ...coreApp,
  loadShellState: (cwd: string) => coreApp.loadShellState(cwd, codingComponent.loadShell),
  async handleDesktopAction(...args: Parameters<typeof coreApp.handleDesktopAction>) {
    const result = await codingComponent.handleAction(...args)
    return result.handled ? result.result : coreApp.handleDesktopAction(...args)
  },
}

const modules = {
  packages,
  app,
  skills,
  coding,
  artifacts,
  dictation,
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
  const piAgentDir = getAgentDirectory()

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

app.subscribeDesktopEvents((event) => {
  process.send?.({ type: 'desktop-event', event })
})

const terminalComponent = createTerminalServiceComponent((message) =>
  process.send?.({ type: 'terminal-rpc-response', message }),
)

let acceptingRequests = true

async function handleRequest(message: ServiceRequest): Promise<ServiceResponse> {
  try {
    if (!acceptingRequests) throw new Error('Desktop service is shutting down.')
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
    void terminalComponent.write(inbound.message as TerminalRpcRequest).catch((error) => {
      console.error('Desktop terminal RPC failed.', error)
      requestShutdown()
    })
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
      yield* Effect.all(
        [
          settledTask(() => codingComponent.dispose()),
          settledTask(() => packagesComponent.dispose()),
          settledTask(() => skillsComponent.dispose()),
          settledTask(() => dictationComponent.dispose()),
        ],
        { concurrency: 'unbounded', discard: true },
      )
      yield* Effect.all(
        [
          settledTask(() => terminalComponent.dispose()),
          settledTask(() => app.disposeDesktopRuntime?.()),
        ],
        { concurrency: 'unbounded', discard: true },
      )
      unregisterArtifactCleanup()
      unregisterCodingMigration()
      unregisterCodingBranchFallbacks()
    }).pipe(Effect.ensuring(Effect.promise(disposeThreadStateDatabase))),
    { label: 'Desktop service', timeout: desktopShutdownTimeouts.desktopServiceCleanupMs },
  ),
)

function requestShutdown() {
  acceptingRequests = false
  void shutdownCoordinatorPromise
    .then((coordinator) => Effect.runPromise(coordinator.shutdown))
    .finally(() => process.exit(0))
}

process.once('disconnect', requestShutdown)
// Keep listeners registered until exit. signal-exit can re-send a signal after
// a once-listener removes itself, cutting asynchronous cleanup short.
process.on('SIGTERM', requestShutdown)
process.on('SIGINT', requestShutdown)

void getServiceDiagnostics().then((diagnostics) => {
  process.send?.({ type: 'ready', diagnostics })
})
