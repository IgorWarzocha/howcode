import { normalizeModelRegistryContextWindows } from '../../shared/model-context-window-normalization.ts'
import { getPiModule } from '../pi-module.ts'
import {
  abortHeadlessExtensionCommand,
  isHeadlessExtensionCommandRunning,
} from '../runtime/agent-session-extensions.ts'
import { createArtifactTools } from '../runtime/artifact-tools.ts'
import { createAttachmentFileTools } from '../runtime/attachment-file-tools.ts'
import { getRuntimeSystemPrompt } from '../runtime/chat-system-prompt.ts'
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
  getRuntimeDefaultProjectTrust,
  resolveRuntimeProjectTrust,
} from '../runtime/isolated-settings-manager.ts'
import type { PiRuntime } from '../runtime/types.ts'
import { invokeMainRequest } from './main-request-client.ts'
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
    ProjectTrustStore,
    createAgentSession,
    getAgentDir,
    hasTrustRequiringProjectResources,
  } = await getPiModule()
  const agentDir = getAgentDir()
  const defaultProjectTrust = getRuntimeDefaultProjectTrust({
    SettingsManager,
    agentDir,
    cwd: options.cwd,
  })
  const projectTrusted = resolveRuntimeProjectTrust({
    ProjectTrustStore,
    agentDir,
    cwd: options.cwd,
    defaultProjectTrust,
    hasTrustRequiringProjectResources,
    settingsCwd: options.settingsCwd,
  })
  const authStorage = AuthStorage.create()
  const modelRegistry = normalizeModelRegistryContextWindows(
    ModelRegistry.create(authStorage, `${agentDir}/models.json`),
  )
  const settingsManager = createRuntimeSettingsManager({
    SettingsManager,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    projectTrusted,
  })
  const sessionDir = options.sessionDir ?? settingsManager.getSessionDir() ?? undefined
  const resourceLoader = await createIsolatedRuntimeResourceLoader({
    DefaultResourceLoader,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    settingsManager,
    projectTrusted,
    systemPrompt: getRuntimeSystemPrompt({ settingsCwd: options.settingsCwd }),
  })
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
    resourceLoader,
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
          ],
        }
      : {}),
  })
  const runtime = {
    cwd: options.cwd,
    session,
    chatGroupId: options.chatGroupId ?? null,
    attachmentFileAccess: attachmentFileTools?.access,
  } satisfies PiRuntime

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
