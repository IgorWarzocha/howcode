import { normalizeModelRegistryContextWindows } from '../../shared/model-context-window-normalization.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import {
  ensureNativeExtensionRuntimePath,
  getNativeExtensionRuntimePaths,
} from '../native-extensions/native-extension-paths.ts'
import { getPiModule } from '../pi-module.ts'
import {
  abortHeadlessExtensionCommand,
  isHeadlessExtensionCommandRunning,
} from '../runtime/agent-session-extensions.ts'
import { createArtifactTools } from '../runtime/artifact-tools.ts'
import { createAttachmentFileTools } from '../runtime/attachment-file-tools.ts'
import { getRuntimeSystemPrompt } from '../runtime/chat-system-prompt.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
} from '../runtime/isolated-settings-manager.ts'
import type { PiRuntime } from '../runtime/types.ts'
import { publishComposerUpdate } from './live-thread-publisher.ts'
import { invokeMainRequest } from './main-request-client.ts'
import { createNativeAskQuestionsTools } from './native-ask-questions-tool.ts'
import {
  bindRuntimeExtensionHandlers,
  refreshRuntimeExtensionHandlers,
} from './runtime-extension-bindings.ts'
import { handleRuntimeSessionEvent } from './runtime-session-events.ts'

type LiveRuntimeFactoryHandlers = {
  reloadRuntimeSettingsIfSafe: (runtimeKey: string) => Promise<boolean>
  scheduleRuntimeDisposal: (runtimeKey: string) => void
  suspendRuntimeDisposal: (runtimeKey: string) => void
}

async function getEnabledNativeExtensionsForRuntime(options: {
  sessionManager?: PiRuntime['session']['sessionManager']
}) {
  const sessionPath = options.sessionManager?.getSessionFile?.() ?? null
  if (sessionPath) {
    const enabled = await invokeMainRequest('getSessionNativeExtensions', { sessionPath })
    if (enabled) return enabled
    const defaultEnabled = await invokeMainRequest('snapshotDefaultNativeExtensions', {})
    await invokeMainRequest('setSessionNativeExtensions', {
      sessionPath,
      enabled: defaultEnabled,
    })
    return defaultEnabled
  }

  return await invokeMainRequest('snapshotDefaultNativeExtensions', {})
}

async function applyNativeExtensionRuntimeEnvironment(enabledNativeExtensions: string[]) {
  if (!enabledNativeExtensions.includes('smartBtw')) return
  const cfg = await invokeMainRequest('getNativeSmartBtwConfig', {})
  updateOptionalEnvironmentValue('HOWCODE_SMART_BTW_MODEL', cfg.model)
  updateOptionalEnvironmentValue('HOWCODE_COMPOSER_MODEL', cfg.composerModel)
  updateOptionalEnvironmentValue('HOWCODE_SMART_BTW_THINKING', cfg.thinking)
}

function updateOptionalEnvironmentValue(key: string, value: string | null | undefined) {
  if (value?.trim()) process.env[key] = value
  else delete process.env[key]
}

export async function createLiveRuntime(
  options: {
    cwd: string
    sessionDir?: string | undefined | null | undefined
    settingsCwd?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
    sessionManager?: PiRuntime['session']['sessionManager']
  },
  handlers: LiveRuntimeFactoryHandlers,
): Promise<PiRuntime> {
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    DefaultResourceLoader,
    createAgentSession,
    defineTool,
    getAgentDir,
  } = await getPiModule()
  const agentDir = getAgentDir()
  const authStorage = AuthStorage.create()
  const modelRegistry = normalizeModelRegistryContextWindows(
    ModelRegistry.create(authStorage, `${agentDir}/models.json`),
  )
  const enabledNativeExtensions = await getEnabledNativeExtensionsForRuntime(
    options.sessionManager ? { sessionManager: options.sessionManager } : {},
  )
  await applyNativeExtensionRuntimeEnvironment(enabledNativeExtensions)
  const settingsManager = createRuntimeSettingsManager({
    SettingsManager,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    additionalExtensions: getNativeExtensionRuntimePaths(
      enabledNativeExtensions.filter((id) => id !== 'askQuestions'),
    ),
  })
  const sessionDir = options.sessionDir ?? settingsManager.getSessionDir() ?? undefined
  const resourceLoader = await createIsolatedRuntimeResourceLoader({
    DefaultResourceLoader,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    settingsManager,
    systemPrompt: getRuntimeSystemPrompt({ settingsCwd: options.settingsCwd }),
  })
  let runtime: PiRuntime | null = null
  const nativeAskQuestionTools = enabledNativeExtensions.includes('askQuestions')
    ? await createNativeAskQuestionsTools({
        defineTool,
        extensionPath: ensureNativeExtensionRuntimePath('askQuestions'),
        getRuntime: () => runtime,
        onStateChange: () => {
          if (!runtime) return
          const activeRuntime = runtime
          void buildComposerState(activeRuntime).then((composer) => {
            publishComposerUpdate(composer, {
              projectId: activeRuntime.cwd,
              sessionPath: activeRuntime.session.sessionFile,
            })
          })
        },
      })
    : []
  const attachmentFileTools = options.settingsCwd
    ? createAttachmentFileTools({
        cwd: options.cwd,
        autoResizeImages: settingsManager.getImageAutoResize(),
      })
    : null
  const { session } = await createAgentSession({
    cwd: options.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    ...(resourceLoader ? { resourceLoader } : {}),
    sessionManager: options.sessionManager ?? SessionManager.create(options.cwd, sessionDir),
    ...(options.settingsCwd
      ? {
          noTools: 'builtin' as const,
          customTools: [
            ...(attachmentFileTools?.tools ?? []),
            ...createArtifactTools({
              createArtifact: (input) => invokeMainRequest('createArtifact', input),
              editArtifact: (input) => invokeMainRequest('editArtifact', input),
              getArtifact: ({ conversationId, slug }) =>
                invokeMainRequest('getArtifact', { artifactSlug: slug, conversationId }),
              listArtifacts: (conversationId) =>
                invokeMainRequest('listArtifacts', { conversationId }),
            }),
            ...nativeAskQuestionTools,
          ],
        }
      : nativeAskQuestionTools.length > 0
        ? { customTools: nativeAskQuestionTools }
        : {}),
  })
  runtime = {
    cwd: options.cwd,
    session,
    chatGroupId: options.chatGroupId ?? null,
    attachmentFileAccess: attachmentFileTools?.access,
  } satisfies PiRuntime

  if (!options.sessionManager) {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
    if (runtimeKey) {
      await invokeMainRequest('setSessionNativeExtensions', {
        sessionPath: runtimeKey,
        enabled: enabledNativeExtensions,
      })
    }
  }

  session.subscribe((event) =>
    handleRuntimeSessionEvent(runtime, event, {
      isRuntimeExtensionCommandRunning,
      reloadRuntimeSettingsIfSafe: handlers.reloadRuntimeSettingsIfSafe,
      scheduleRuntimeDisposal: handlers.scheduleRuntimeDisposal,
      suspendRuntimeDisposal: handlers.suspendRuntimeDisposal,
    }),
  )

  await bindRuntimeExtensionHandlers(runtime, {
    isRuntimeExtensionCommandRunning,
    reloadRuntimeSettingsIfSafe: handlers.reloadRuntimeSettingsIfSafe,
  })
  return runtime
}

export function abortRuntimeExtensionCommand(runtime: PiRuntime) {
  return abortHeadlessExtensionCommand(runtime.session)
}

export function isRuntimeExtensionCommandRunning(runtime: PiRuntime) {
  return isHeadlessExtensionCommandRunning(runtime.session)
}

export async function refreshRuntimeExtensionBindings(
  runtime: PiRuntime,
  reloadRuntimeSettingsIfSafe: (runtimeKey: string) => Promise<boolean>,
) {
  await refreshRuntimeExtensionHandlers(runtime, {
    isRuntimeExtensionCommandRunning,
    reloadRuntimeSettingsIfSafe,
  })
}
