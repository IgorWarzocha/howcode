import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { createArtifact, editArtifact, getArtifact, listArtifacts } from '../artifact-state-db.ts'
import { getPiModule } from '../pi-module.ts'
import {
  abortHeadlessExtensionCommand,
  bindHeadlessAgentSessionExtensions,
  isHeadlessExtensionCommandRunning,
  refreshHeadlessAgentSessionExtensionBindings,
} from './agent-session-extensions.ts'
import { createArtifactTools } from './artifact-tools.ts'
import { createAttachmentFileTools } from './attachment-file-tools.ts'
import { getRuntimeSystemPrompt } from './chat-system-prompt.ts'
import { buildComposerState } from './composer-state.ts'
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
  getRuntimeDefaultProjectTrust,
  resolveRuntimeProjectTrust,
} from './isolated-settings-manager.ts'
import {
  deleteRuntimeRecordIfCurrent,
  getRuntimeRecord,
  getRuntimeRecordSnapshots,
  registerRuntime,
  scheduleRuntimeDisposal,
  suspendRuntimeDisposal,
  withRuntimeMutationLock,
} from './registry/runtime-registry-state.ts'
import { handleRuntimeSessionEvent } from './runtime-session-events.ts'
import { normalizeRuntimeSettingsCwd } from './runtime-settings-cwd.ts'
import { rememberSessionPath } from './session-path-index.ts'
import { createRuntimeSettingsRefreshController, isRuntimeBusy } from './settings-refresh.ts'
import { publishComposerUpdate, publishThreadUpdate } from './thread-publisher.ts'

export { withRuntimeMutationLock } from './registry/runtime-registry-state.ts'

import { normalizeModelRegistryContextWindows } from '../../shared/model-context-window-normalization.ts'
import type { RuntimeRecord } from './registry/runtime-registry-state.ts'
import type { PiRuntime } from './types.ts'

const settingsRefreshController = createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords: getRuntimeRecordSnapshots,
  withRuntimeMutationLock,
  afterReload: (runtime) => refreshRuntimeExtensionBindings(runtime),
  isRuntimeBusy: isHowcodeRuntimeBusy,
  buildComposerState,
  publishComposerUpdate,
})

function isHowcodeRuntimeBusy(runtime: PiRuntime) {
  return isRuntimeBusy(runtime) || isRuntimeExtensionCommandRunning(runtime)
}

function publishRuntimeComposerState(runtime: PiRuntime) {
  return buildComposerState(runtime)
    .then((composer) => {
      publishComposerUpdate(composer, {
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile,
      })
    })
    .catch(() => {
      // Ignore transient composer snapshot errors; a later runtime event will republish state.
    })
}

function handleExtensionCommandStateChange(runtime: PiRuntime) {
  void publishRuntimeComposerState(runtime)
  if (!isRuntimeExtensionCommandRunning(runtime)) {
    void publishThreadUpdate(runtime, 'compaction').catch(() => {
      // A branch-summary-like extension command just ended. If Pi exposed it through
      // isCompacting, clear the live thread pill even when Pi does not emit compaction_end.
    })
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
    if (runtimeKey) {
      void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
        // Keep stale settings marked; the next safe point retries silently.
      })
    }
  }
}

export async function reloadRuntimeSettingsIfSafe(
  sessionPath: string,
  options: { useMutationLock?: boolean | undefined } = {},
): Promise<boolean> {
  return settingsRefreshController.reloadIfSafe(sessionPath, options)
}

export async function markRuntimeSettingsStale(sessionPath: string | null | undefined) {
  const runtimeKey = getPersistedSessionPath(sessionPath ?? null)
  if (!runtimeKey) {
    return
  }

  settingsRefreshController.markStale(runtimeKey)
}

export async function markRuntimeSettingsStaleForProject(
  projectPath?: string | undefined | null | undefined,
) {
  settingsRefreshController.markStaleForProject(projectPath)
}

export async function markRuntimeSettingsStaleForSettingsCwd(
  settingsCwd?: string | undefined | null | undefined,
) {
  settingsRefreshController.markStaleForSettingsCwd(settingsCwd)
}

async function createRuntime(options: {
  cwd: string
  sessionDir?: string | undefined | null | undefined
  settingsCwd?: string | undefined | null | undefined
  chatGroupId?: string | undefined | null | undefined
  sessionManager?: PiRuntime['session']['sessionManager']
}): Promise<PiRuntime> {
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    DefaultResourceLoader,
    ProjectTrustStore,
    createAgentSession,
    getAgentDir,
    hasProjectTrustInputs,
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
    hasProjectTrustInputs,
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
              createArtifact,
              editArtifact,
              getArtifact: ({ conversationId, slug }) => getArtifact(slug, conversationId),
              listArtifacts,
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

  rememberSessionPath(session.sessionFile, options.cwd)

  session.subscribe((event) =>
    handleRuntimeSessionEvent(runtime, event, {
      isRuntimeBusy: isHowcodeRuntimeBusy,
      reloadRuntimeSettingsIfSafe,
      isRuntimeSettingsStale: (runtimeKey) => settingsRefreshController.isStale(runtimeKey),
      publishComposerUpdate,
      publishThreadUpdate,
    }),
  )

  await bindHeadlessAgentSessionExtensions(session, {
    onExtensionCommandStateChange: () => {
      handleExtensionCommandStateChange(runtime)
    },
  })

  return runtime
}

export function abortRuntimeExtensionCommand(runtime: PiRuntime) {
  return abortHeadlessExtensionCommand(runtime.session)
}

export function isRuntimeExtensionCommandRunning(runtime: PiRuntime) {
  return isHeadlessExtensionCommandRunning(runtime.session)
}

export async function refreshRuntimeExtensionBindings(runtime: PiRuntime) {
  await refreshHeadlessAgentSessionExtensionBindings(runtime.session, {
    onExtensionCommandStateChange: () => {
      handleExtensionCommandStateChange(runtime)
    },
  })
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  if (!persistedSessionPath) {
    return null
  }

  const record = getRuntimeRecord(persistedSessionPath)
  if (!record) {
    return null
  }

  return record.runtimePromise
}

export async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: {
    suspendDisposal?: boolean | undefined
    settingsCwd?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
  } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  if (!persistedSessionPath) {
    throw new Error('A persisted session path is required to open a live runtime.')
  }

  const settingsCwd = normalizeRuntimeSettingsCwd(options.settingsCwd)
  const existingRuntime = getRuntimeRecord(persistedSessionPath)
  if (existingRuntime) {
    if (existingRuntime.settingsCwd === settingsCwd) {
      if (options.suspendDisposal) {
        suspendRuntimeDisposal(persistedSessionPath)
      }

      const runtime = await existingRuntime.runtimePromise
      if (!isHowcodeRuntimeBusy(runtime)) {
        await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
      }
      return runtime
    } else {
      const runtime = await existingRuntime.runtimePromise
      runtime.session.dispose()
      deleteRuntimeRecordIfCurrent(persistedSessionPath, existingRuntime)
    }
  }

  const { SessionManager } = await getPiModule()
  const sessionManager = SessionManager.open(persistedSessionPath)
  let record: RuntimeRecord | null = null
  const runtimePromise = createRuntime({
    cwd: sessionManager.getCwd(),
    settingsCwd,
    chatGroupId: options.chatGroupId ?? null,
    sessionManager,
  }).catch((error) => {
    if (record) {
      deleteRuntimeRecordIfCurrent(persistedSessionPath, record)
    }

    throw error
  })

  record = registerRuntime(persistedSessionPath, runtimePromise, settingsCwd)
  return runtimePromise
}

export async function createRuntimeForNewSession(
  cwd: string,
  sessionDir?: string | undefined | null | undefined,
  options: {
    branchName?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
  } = {},
) {
  const runtime = await createRuntime({
    cwd,
    sessionDir,
    settingsCwd: sessionDir ?? null,
    chatGroupId: options.chatGroupId ?? null,
  })
  runtime.branchName = options.branchName ?? null
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)

  if (runtimeKey) {
    const existingRuntime = getRuntimeRecord(runtimeKey)
    if (existingRuntime) {
      suspendRuntimeDisposal(runtimeKey)
      runtime.session.dispose()
      return await existingRuntime.runtimePromise
    }

    registerRuntime(runtimeKey, Promise.resolve(runtime), sessionDir ?? null)
  }

  return runtime
}

export function scheduleRuntimeDisposalForRuntime(runtime: PiRuntime) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) {
    scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy)
  }
}
