import * as Effect from 'effect/Effect'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import * as artifacts from '../components/artifacts/service/index.ts'
import { artifactsDatabaseSchema } from '../components/artifacts/service/schema.ts'
import { createDictationService } from '../components/dictation/service/index.ts'
import { createPackageUiService } from '../components/packages/service/index.ts'
import { createSkillsService } from '../components/skills/service/index.ts'
import * as terminalManager from '../components/terminal/service/index.ts'
import { createTerminalServiceComponent } from '../components/terminal/service/index.ts'
import { createWorkingDirectoriesService } from '../components/working-directories/service/index.ts'
import { workingDirectoriesDatabaseSchema } from '../components/working-directories/service/schema.ts'
import {
  setDirectoryGitOpsMode,
  setDirectoryRepoOrigin,
  workingDirectoryChatBranchFallbacks,
} from '../components/working-directories/service/state.ts'
import type { DesktopEvent } from '../shared/desktop-contracts.ts'
import {
  type DesktopServiceRemoteModuleName,
  type DesktopServiceRemoteRuntime,
  desktopServiceRemoteMethods,
} from '../shared/desktop-service-rpc.ts'
import { desktopShutdownTimeouts } from '../shared/desktop-shutdown-deadlines.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { makeShutdownCoordinator } from '../shared/effect-shutdown.ts'
import { getThemeValues } from '../shared/gui-theme.ts'
import type { TerminalRpcRequest } from '../shared/terminal-rpc.ts'
import { isToolkitComponentEnabled } from '../shared/toolkit-components.ts'
import { registerConversationCleanup } from './app-service/chat-actions.ts'
import { getRuntimeConversationMetadata } from './app-service/conversation-state.ts'
import * as coreApp from './app-service.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { registerChatBranchFallbacks } from './chat-repository/chat-branch-fallbacks.ts'
import {
  configureDatabaseSchemas,
  disposeChatStateDatabase,
  registerDatabaseStartupTask,
} from './chat-repository/db.ts'
import { inspectDurableActivity } from './durable-runtime/host.ts'
import { createGitIntegration } from './git-integration/index.ts'
import { cleanupLegacyCheckpoints } from './git-integration/legacy-checkpoints.ts'
import { createInstalledPluginServices } from './plugins/runtime.ts'
import { emitDesktopEvent } from './runtime/desktop-events.ts'
import { getAgentDirectory } from './settings/paths.ts'
import { loadPiSettings } from './settings/preferences.ts'
import { loadThemeState } from './settings/themes.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'
import { syncWorkspaceOrganization } from './workspace-repository.ts'

const ServiceRequestSchema = Schema.Struct({
  type: Schema.Literal('request'),
  id: Schema.String,
  module: Schema.Literals([
    'dev',
    'app',
    'skills',
    'plugins',
    'workingDirectories',
    'artifacts',
    'dictation',
    'packages',
  ]),
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

configureDatabaseSchemas([workingDirectoriesDatabaseSchema, artifactsDatabaseSchema])

const skillsComponent = createSkillsService()
let activeRequests = 0
let componentAdmission = true
const skills = skillsComponent.service
const dictationComponent = createDictationService()
const dictation = dictationComponent.service
const workingDirectoriesComponent = createWorkingDirectoriesService({
  deleteArtifactsForConversations: artifacts.deleteArtifactsForConversations,
  listTerminals: terminalManager.listTerminals,
  closeWorkspaceTerminals: terminalManager.closeWorkspaceTerminals,
  hasActiveWorkspaceTerminal: terminalManager.hasActiveWorkspaceTerminal,
})
const workingDirectories = workingDirectoriesComponent.service
let gitComponent: ReturnType<typeof createGitIntegration> | undefined
const pluginsComponent = await createInstalledPluginServices(
  {
    publishEvent: (event) => emitDesktopEvent(event as DesktopEvent),
    agent: {
      dataDirectory: getDesktopUserDataPath(),
      async theme(conversationId) {
        const directory =
          getRuntimeConversationMetadata(conversationId)?.directoryId ??
          getDesktopWorkingDirectory()
        const settings = await loadPiSettings(directory)
        const theme = await loadThemeState(settings.theme, directory)
        const { colorScheme, ...cssVars } = getThemeValues(theme)
        return { name: theme.selectedTheme, colors: theme.colors, cssVars, colorScheme }
      },
    },
  },
  {
    '@howaboua/howcode-git': (contribution, host) => {
      gitComponent = createGitIntegration(contribution, host, {
        setDirectoryGitOpsMode,
        setDirectoryRepoOrigin,
      })
      return gitComponent
    },
  },
  async (operation) => {
    // Close admission before live inspection so a new submission cannot race retirement.
    if (activeRequests > 0 || !componentAdmission) return false
    componentAdmission = false
    try {
      const activity = await inspectDurableActivity()
      if (activity.tasks > 0 || activity.submissions > 0) return false
      await operation()
      return true
    } finally {
      componentAdmission = true
    }
  },
)
const plugins = pluginsComponent.service
const packagesComponent = await createPackageUiService(
  { directory: getDesktopUserDataPath(), cwd: process.cwd() },
  () => emitDesktopEvent({ type: 'package-ui-invalidation' }),
  pluginsComponent,
)
const packages = packagesComponent.service
const unregisterArtifactCleanup = registerConversationCleanup(
  artifacts.deleteArtifactsForConversation,
)
const unregisterDirectoryBranchFallbacks = registerChatBranchFallbacks(
  workingDirectoryChatBranchFallbacks,
)
const unregisterGitMigration = registerDatabaseStartupTask(cleanupLegacyCheckpoints())
const app = {
  ...coreApp,
  loadShellState: (cwd: string) =>
    coreApp.loadShellState(cwd, workingDirectoriesComponent.loadShell),
  async loadWorkspaceNavigationState(workspaceId?: string | null) {
    if (isToolkitComponentEnabled(loadAppSettings(), 'coding')) {
      const shell = await workingDirectoriesComponent.loadShell(getDesktopWorkingDirectory())
      syncWorkspaceOrganization(
        shell.directories.map((directory) => ({
          id: directory.id,
          name: directory.name,
          rootId: directory.worktree?.rootDirectoryId ?? directory.id,
        })),
      )
    }
    return coreApp.loadWorkspaceNavigationState(workspaceId)
  },
  async handleDesktopAction(...args: Parameters<typeof coreApp.handleDesktopAction>) {
    const result = await workingDirectoriesComponent.handleAction(...args)
    if (result.handled) return result.result
    const gitResult = await gitComponent?.handleAction(...args)
    return gitResult?.handled ? gitResult.result : coreApp.handleDesktopAction(...args)
  },
}

const { HOWCODE_DEV_RUNTIME: devRuntime } = process.env

const modules = {
  dev: {
    async inspectActivity() {
      if (devRuntime !== '1') {
        throw new Error('Runtime inspection is only available in dev:web.')
      }
      const [activity, terminals] = await Promise.all([
        inspectDurableActivity(),
        terminalManager.listTerminals(),
      ])
      return {
        ...activity,
        requests: activeRequests,
        terminals: terminals.filter(({ status }) => status === 'starting' || status === 'running')
          .length,
      }
    },
  },
  packages,
  app,
  skills,
  plugins,
  workingDirectories,
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
    if (!componentAdmission)
      throw new Error(
        'Component activation is in progress. Retry after it finishes; no action has been replayed.',
      )
    if (!isServiceModuleName(message.module)) {
      throw new Error(`Unknown desktop service module: ${message.module}`)
    }

    const target = getServiceMethod(message.module, message.method)
    if (!target) {
      throw new Error(`Unknown desktop service method: ${message.module}.${message.method}`)
    }

    // Catalog/renderer reads drive activation, but cannot submit agent work.
    const tracked = message.module !== 'dev' && message.module !== 'packages'
    if (tracked) activeRequests += 1
    try {
      const result = await target(...message.args)
      return { type: 'response', id: message.id, ok: true, result }
    } finally {
      if (tracked) activeRequests -= 1
    }
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
      // Stop inventory admission and join any component publication before native disposal.
      yield* settledTask(() => packagesComponent.dispose())
      yield* Effect.all(
        [
          settledTask(() =>
            workingDirectoriesComponent.dispose().then(() => pluginsComponent.dispose()),
          ),
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
      unregisterGitMigration()
      unregisterDirectoryBranchFallbacks()
    }).pipe(Effect.ensuring(Effect.promise(disposeChatStateDatabase))),
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
