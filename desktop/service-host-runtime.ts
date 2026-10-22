import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import type { SidebarMaintenance } from '@howaboua/howcode-classic-navigation/host-contribution'
import * as Effect from 'effect/Effect'
import * as Result from 'effect/Result'
import { ResponseDefectEncoded } from 'effect/rpc/RpcMessage'
import * as Schema from 'effect/Schema'
import {
  createPackageManager,
  createPackageUiService,
  defaultComponentPackages,
} from '../components/packages/service/index.ts'
import {
  createSidebarHost,
  createWorkingDirectoriesService,
  type WorkingDirectoryPeers,
} from '../components/working-directories/service/index.ts'
import { workingDirectoriesDatabaseSchema } from '../components/working-directories/service/schema.ts'
import {
  persistedWorktreeBranchFacts,
  setDirectoryGitOpsMode,
  setDirectoryRepoOrigin,
} from '../components/working-directories/service/state.ts'
import { getPersistedConversationId } from '../shared/conversation-ids.ts'
import { getComposerRequest } from '../shared/desktop-action-payloads.ts'
import type { DesktopEvent } from '../shared/desktop-contracts.ts'
import { DesktopLaunchSchema, desktopLaunchEnvironmentKey } from '../shared/desktop-launch.ts'
import type { PiSkillsService } from '../shared/desktop-service-contracts.ts'
import type { DesktopServiceMessage } from '../shared/desktop-service-ipc.ts'
import {
  type DesktopServiceRemoteModuleName,
  type DesktopServiceRemoteRuntime,
  desktopServiceRemoteMethods,
} from '../shared/desktop-service-rpc.ts'
import { desktopShutdownTimeouts } from '../shared/desktop-shutdown-deadlines.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { makeShutdownCoordinator, type ShutdownCoordinator } from '../shared/effect-shutdown.ts'
import { getThemeValues } from '../shared/gui-theme.ts'
import { registerConversationCleanup } from './app-service/chat-actions.ts'
import { getRuntimeConversationMetadata } from './app-service/conversation-state.ts'
import * as coreApp from './app-service.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { registerChatBranchFallbacks } from './chat-repository/chat-branch-fallbacks.ts'
import {
  configureDatabaseSchemas,
  disposeChatStateDatabase,
  runDatabaseTask,
} from './chat-repository/db.ts'
import { setChatDiffPreferences } from './chat-repository.ts'
import { bindAppControl } from './durable-runtime/app-control-tool.ts'
import {
  bindRuntimeDelivery,
  getDurableRuntime,
  inspectDurableActivity,
  notebookStorageHost,
  readRuntimePackageActivation,
  reconcileRuntimeGeneration,
  stopDurableAdmission,
  withDurableAdmissionClosed,
} from './durable-runtime/host.ts'
import { createInputDelivery, InputDeliveryExtension } from './durable-runtime/input-delivery.ts'
import { getDurableHostVersion } from './durable-runtime/packages.ts'
import { completeGitCommitMessage } from './git-integration/git-commit-message.ts'
import { cleanupLegacyCheckpoints } from './git-integration/legacy-checkpoints.ts'
import { getDirectoryGitOpsMode } from './git-integration/metadata.ts'
import { peopleStorage } from './people-integration.ts'
import { createPluginBoard } from './plugins/board.ts'
import { createPluginConversations } from './plugins/conversations.ts'
import { bindFeatureOperations } from './plugins/feature-operations.ts'
import { createPluginFixedInitiative } from './plugins/fixed-initiative.ts'
import { createPluginInitiativeConfiguration } from './plugins/initiative.ts'
import {
  createInstalledPluginServices,
  deletePluginConversations,
  hasInstalledPluginService,
  installedBusyComponents,
  installedTerminalCapability,
  resolveInstalledGitProgress,
} from './plugins/runtime.ts'
import { boundPluginRuntime } from './plugins/runtime-bindings.ts'
import { createPluginSetupHost } from './plugins/setup.ts'
import { createPluginWorkspaceHost } from './plugins/workspaces.ts'
import { emitDesktopEvent } from './runtime/desktop-events.ts'
import { withDirectoryActivity } from './runtime/directory-activity.ts'
import { getDurableModels } from './settings/models.ts'
import { getAgentDirectory } from './settings/paths.ts'
import { loadShellPreferences } from './settings/preferences.ts'
import { loadThemeState } from './settings/themes.ts'
import { skillsPathsHost } from './skills-integration/paths.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'
import { workspaceLayout } from './workspace-layout.ts'
import { syncWorkspaceOrganization } from './workspace-repository.ts'

const ServiceRequestSchema = Schema.Struct({
  type: Schema.Literal('request'),
  id: Schema.String,
  module: Schema.Literals(['dev', 'app', 'skills', 'plugins', 'workingDirectories', 'packages']),
  method: Schema.String,
  args: Schema.mutable(Schema.Array(Schema.Unknown)),
})

type ServiceRequest = typeof ServiceRequestSchema.Type

type ServiceResponse = Extract<DesktopServiceMessage, { type: 'response' }>

const ServiceInboundMessageSchema = Schema.Union([
  ServiceRequestSchema,
  Schema.Struct({ type: Schema.Literal('terminal-rpc-request'), message: Schema.Unknown }),
])

const decodeServiceInboundMessage = Schema.decodeUnknownResult(ServiceInboundMessageSchema)

let activeRequests = 0
let componentAdmission = true
let acceptingRequests = true
let shutdownExitCode = 0
let cleanupComplete = false
let shutdownCoordinatorPromise: Promise<ShutdownCoordinator> | undefined

function sendServiceMessage(message: unknown) {
  if (!process.connected) return
  process.send?.(message, (error: Error | null) => {
    if (!error) return
    console.error('Desktop service IPC failed.', error)
    requestShutdown(1)
  })
}

process.once('disconnect', () => requestShutdown())
// Keep listeners registered until exit. signal-exit can re-send a signal after
// a once-listener removes itself, cutting asynchronous cleanup short.
process.on('SIGTERM', () => requestShutdown())
process.on('SIGINT', () => requestShutdown())

configureDatabaseSchemas([workingDirectoriesDatabaseSchema])
const unbindAppControl = bindAppControl(coreApp.appControl)
const serializedLaunch = process.env[desktopLaunchEnvironmentKey]
const standaloneLaunch = serializedLaunch
  ? Schema.decodeUnknownSync(DesktopLaunchSchema)(JSON.parse(serializedLaunch))
  : undefined
const inputDelivery = createInputDelivery()
const unbindRuntimeDelivery = bindRuntimeDelivery({
  extension: InputDeliveryExtension,
  reconcileSources: () => inputDelivery.reconcileSources(),
})
const hostVersion = await getDurableHostVersion()

const legacyPeople = peopleStorage.read()
if (!Array.isArray(legacyPeople)) throw new Error('Invalid saved People directory.')
await createPackageManager({
  directory: getDesktopUserDataPath(),
  cwd: process.cwd(),
  hostVersion,
}).seedDefaults(
  defaultComponentPackages,
  path.dirname(fileURLToPath(import.meta.url)),
  legacyPeople.length > 0 ? [] : ['@howaboua/howcode-people'],
)

const sidebarPackage = '@howaboua/howcode-classic-navigation'
const workingDirectoryPeers: WorkingDirectoryPeers = {
  get sidebar() {
    return hasInstalledPluginService(sidebarPackage) ? sidebarMaintenance : undefined
  },
  deleteConversations: deletePluginConversations,
  listTerminals: async () => (await installedTerminalCapability()?.listTerminals()) ?? [],
  closeWorkspaceTerminals: async (id) => {
    await installedTerminalCapability()?.closeWorkspaceTerminals(id)
  },
  hasActiveWorkspaceTerminal: async (id) =>
    (await installedTerminalCapability()?.hasActiveWorkspaceTerminal(id)) ?? false,
}
const workingDirectoriesComponent = createWorkingDirectoriesService(workingDirectoryPeers)
const workingDirectories = workingDirectoriesComponent.service
const pluginsComponent = await createInstalledPluginServices(
  {
    board: createPluginBoard(),
    fixedInitiative: createPluginFixedInitiative(),
    initiativeConfiguration: createPluginInitiativeConfiguration(),
    inputDelivery,
    workspaceLayout: async (request) => workspaceLayout(request),
    setup: createPluginSetupHost(
      standaloneLaunch
        ? {
            ...standaloneLaunch,
            args: [...standaloneLaunch.args, '--data-path', path.resolve(getDesktopUserDataPath())],
          }
        : undefined,
    ),
    models: getDurableModels,
    notebookStorage: notebookStorageHost,
    sidebar: createSidebarHost(workingDirectoryPeers),
    terminal: {
      dataDirectory: getDesktopUserDataPath(),
      withDirectoryActivity,
      send: (message) => sendServiceMessage({ type: 'terminal-rpc-response', message }),
    },
    skillsPaths: skillsPathsHost,
    peopleStorage,
    dictation: {
      initialSettings: () => {
        const settings = loadAppSettings()
        return {
          modelId: settings.dictationModelId,
          maxDurationSeconds: settings.dictationMaxDurationSeconds,
          showButton: settings.showDictationButton,
        }
      },
    },
    git: {
      cleanupLegacyState: (purge) => runDatabaseTask(cleanupLegacyCheckpoints(purge)),
      getDirectoryGitOpsMode,
      publishDiffEvent: (event) => emitDesktopEvent(event as DesktopEvent),
      actionHost: (payload) => ({
        setDirectoryGitOpsMode,
        setDirectoryRepoOrigin,
        persistedConversationId: getPersistedConversationId(
          // biome-ignore lint/complexity/useLiteralKeys: The component host payload is an index-signature contract.
          typeof payload['conversationId'] === 'string' ? payload['conversationId'] : null,
        ),
        saveDiffPreferences: setChatDiffPreferences,
        completeCommitMessage: (prompt) =>
          completeGitCommitMessage(getComposerRequest(payload), prompt),
      }),
    },
    conversations: createPluginConversations(),
    workspaces: createPluginWorkspaceHost(async (directory) => {
      const progress = resolveInstalledGitProgress()
      if (!progress) throw new Error('Git progress is unavailable.')
      return progress(directory)
    }),
    publishEvent: (event) => emitDesktopEvent(event as DesktopEvent),
    agent: {
      dataDirectory: getDesktopUserDataPath(),
      async theme(conversationId) {
        const directory =
          getRuntimeConversationMetadata(conversationId)?.directoryId ??
          getDesktopWorkingDirectory()
        const settings = await loadShellPreferences(directory)
        const theme = await loadThemeState(settings.theme, directory)
        const { colorScheme, ...cssVars } = getThemeValues(theme)
        return { name: theme.selectedTheme, colors: theme.colors, cssVars, colorScheme }
      },
    },
  },
  async (operation) => {
    // Close admission before live inspection so a new submission cannot race retirement.
    if (!acceptingRequests || activeRequests > 0 || !componentAdmission) return false
    componentAdmission = false
    try {
      const applied = await withDurableAdmissionClosed(async () => {
        const activity = await inspectDurableActivity()
        if (activity.tasks > 0 || activity.submissions > 0) return false
        await operation()
        // Native capability publication and policy repair precede new-work admission.
        await reconcileRuntimeGeneration()
        return true
      })
      if (applied && acceptingRequests && boundPluginRuntime())
        await inputDelivery.reconcileSources()
      return applied
    } finally {
      componentAdmission = acceptingRequests
    }
  },
)
const plugins = pluginsComponent.service
// Dispatch through the current admitted host generation, never a distribution implementation.
const sidebarMaintenance: SidebarMaintenance = {
  recordRootProvenance: (payload) =>
    plugins.hostRequest(sidebarPackage, 'recordRootProvenance', payload) as ReturnType<
      SidebarMaintenance['recordRootProvenance']
    >,
  scanDirectories: (payload) =>
    plugins.hostRequest(sidebarPackage, 'scanDirectories', payload) as ReturnType<
      SidebarMaintenance['scanDirectories']
    >,
  importDirectories: (payload) =>
    plugins.hostRequest(sidebarPackage, 'importDirectories', payload) as ReturnType<
      SidebarMaintenance['importDirectories']
    >,
  fullClean: (payload) =>
    plugins.hostRequest(sidebarPackage, 'fullClean', payload) as ReturnType<
      SidebarMaintenance['fullClean']
    >,
}
const skills: PiSkillsService = {
  getSkillsSettings: async (request) =>
    (await plugins.request('@howaboua/howcode-skills', 'getSkillsSettings', request)) as Awaited<
      ReturnType<PiSkillsService['getSkillsSettings']>
    >,
  updateSkillsSettings: async (request) =>
    (await plugins.request('@howaboua/howcode-skills', 'updateSkillsSettings', request)) as Awaited<
      ReturnType<PiSkillsService['updateSkillsSettings']>
    >,
  searchPiSkills: async (request) =>
    (await plugins.request('@howaboua/howcode-skills', 'searchPiSkills', request)) as Awaited<
      ReturnType<PiSkillsService['searchPiSkills']>
    >,
  listConfiguredPiSkills: async (request) =>
    (await plugins.request(
      '@howaboua/howcode-skills',
      'listConfiguredPiSkills',
      request,
    )) as Awaited<ReturnType<PiSkillsService['listConfiguredPiSkills']>>,
  installPiSkill: async (request) =>
    (await plugins.request('@howaboua/howcode-skills', 'installPiSkill', request)) as Awaited<
      ReturnType<PiSkillsService['installPiSkill']>
    >,
  removePiSkill: async (request) =>
    (await plugins.request('@howaboua/howcode-skills', 'removePiSkill', request)) as Awaited<
      ReturnType<PiSkillsService['removePiSkill']>
    >,
}
const packagesComponent = await createPackageUiService(
  { directory: getDesktopUserDataPath(), cwd: process.cwd(), hostVersion },
  () => emitDesktopEvent({ type: 'package-ui-invalidation' }),
  pluginsComponent,
  { inputDelivery, activeInventory: readRuntimePackageActivation },
)
const unbindPackageOperations = bindFeatureOperations(
  'howcode.packages',
  packagesComponent.operations,
)
const packages = packagesComponent.service
const unregisterComponentCleanup = registerConversationCleanup((id) =>
  deletePluginConversations([id]),
)
const unregisterDirectoryBranchFallbacks = registerChatBranchFallbacks(persistedWorktreeBranchFacts)
const app = {
  ...coreApp,
  loadShellState: (cwd: string) =>
    coreApp.loadShellState(cwd, workingDirectoriesComponent.loadShell),
  async loadWorkspaceNavigationState(workspaceId?: string | null) {
    {
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
    const gitResult = await pluginsComponent.handleAction(...args)
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
      const activity = await inspectDurableActivity()
      return {
        ...activity,
        requests: activeRequests,
        busyComponents: installedBusyComponents(),
      }
    },
  },
  packages,
  app,
  skills,
  plugins,
  workingDirectories,
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
    terminalAvailable: Boolean(installedTerminalCapability()),
  }
}

app.subscribeDesktopEvents((event) => {
  sendServiceMessage({ type: 'desktop-event', event })
})

const pendingResponses = new Set<Promise<void>>()

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
    const terminal = installedTerminalCapability()
    if (!(acceptingRequests && terminal)) {
      sendServiceMessage({
        type: 'terminal-rpc-response',
        message: ResponseDefectEncoded(
          Schema.encodeSync(Schema.Defect())(
            new Error(
              acceptingRequests
                ? 'Terminal component is not installed.'
                : 'Desktop service is shutting down.',
            ),
          ),
        ),
      })
      return
    }
    void terminal.write(inbound.message).catch((error) => {
      console.error('Desktop terminal RPC failed.', error)
      requestShutdown(1)
    })
    return
  }
  const response = handleRequest(inbound)
    .then((result) => {
      sendServiceMessage(result)
    })
    .catch((error: unknown) => {
      console.error('Desktop service response failed.', error)
      requestShutdown(1)
    })
    .finally(() => pendingResponses.delete(response))
  pendingResponses.add(response)
})

async function disposeService() {
  const failures: unknown[] = []
  const attempt = async (operation: () => Promise<void> | void) => {
    try {
      await operation()
    } catch (error) {
      failures.push(error)
    }
  }
  // Stop inventory admission and join publication before native disposal.
  await attempt(unbindPackageOperations)
  await attempt(() => packagesComponent.dispose())
  // A failed drain must retain bindings and the app database until process exit.
  // Disposing their owners anyway would invalidate still-running task hooks.
  await app.disposeDesktopRuntime()
  await Promise.all(pendingResponses)
  unbindAppControl()
  unbindRuntimeDelivery()
  await attempt(() => workingDirectoriesComponent.dispose())
  await attempt(() => pluginsComponent.dispose())
  unregisterComponentCleanup()
  unregisterDirectoryBranchFallbacks()
  await attempt(disposeChatStateDatabase)
  if (failures.length > 0) throw new AggregateError(failures, 'Desktop service cleanup failed.')
  cleanupComplete = true
}

shutdownCoordinatorPromise = Effect.runPromise(
  makeShutdownCoordinator(Effect.promise(disposeService), {
    label: 'Desktop service',
    timeout: desktopShutdownTimeouts.desktopServiceCleanupMs,
  }),
)

function requestShutdown(exitCode = 0) {
  acceptingRequests = false
  componentAdmission = false
  stopDurableAdmission()
  shutdownExitCode = Math.max(shutdownExitCode, exitCode)
  void shutdownCoordinatorPromise
    ?.then((coordinator) => Effect.runPromise(coordinator.shutdown))
    .finally(() => process.exit(cleanupComplete ? shutdownExitCode : 1))
}

try {
  if (acceptingRequests) {
    await packagesComponent.assertServiceReady()
    if (acceptingRequests) await getDurableRuntime()
    const diagnostics = await getServiceDiagnostics()
    if (acceptingRequests) sendServiceMessage({ type: 'ready', diagnostics })
  } else requestShutdown()
} catch (error) {
  console.error(
    'Desktop runtime service failed to initialise.',
    inspect(error, {
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
      colors: false,
      customInspect: false,
    }),
  )
  requestShutdown(1)
}
