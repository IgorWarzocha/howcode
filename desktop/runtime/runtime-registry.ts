import path from 'node:path'
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
import { buildComposerState } from './composer-state.ts'
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
} from './isolated-settings-manager.ts'
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  deleteRuntimeRecordIfCurrent,
  getRuntimeRecord,
  getRuntimeRecordSnapshots,
  registerRuntime,
  scheduleLiveThreadUpdate,
  scheduleRuntimeDisposal,
  suspendRuntimeDisposal,
  withRuntimeMutationLock,
} from './registry/runtime-registry-state.ts'
import { rememberSessionPath } from './session-path-index.ts'
import { createRuntimeSettingsRefreshController, isRuntimeBusy } from './settings-refresh.ts'
import {
  clearRuntimeToolProgress,
  publishComposerUpdate,
  publishThreadUpdate,
  rememberRuntimeToolProgress,
} from './thread-publisher.ts'

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

function normalizeSettingsCwd(settingsCwd?: string | undefined | null | undefined) {
  return settingsCwd ? path.resolve(settingsCwd) : null
}

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
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
    if (runtimeKey) {
      void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
        // Keep stale settings marked; the next safe point retries silently.
      })
    }
  }
}

function publishLiveThreadUpdate(runtime: PiRuntime) {
  void publishThreadUpdate(runtime, 'update')
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

type RuntimeSessionEvent = Parameters<Parameters<PiRuntime['session']['subscribe']>[0]>[0]

function getRuntimeToolProgressPartial(event: RuntimeSessionEvent) {
  if (event.type === 'tool_execution_update') return event.partialResult
  if (event.type === 'tool_execution_end') return event.result
  return undefined
}

function handleRuntimeMessageEnd(
  runtime: PiRuntime,
  runtimeKey: string | null,
  event: Extract<RuntimeSessionEvent, { type: 'message_end' }>,
) {
  if (event.message.role === 'user') {
    cancelLiveThreadUpdate(runtime)
    void publishThreadUpdate(runtime, 'start')
  } else {
    if (event.message.role === 'toolResult') {
      const toolCallId = 'toolCallId' in event.message ? event.message.toolCallId : undefined
      clearRuntimeToolProgress(runtime, {
        toolCallId: typeof toolCallId === 'string' ? toolCallId : undefined,
        toolName: event.message.toolName,
      })
    }
    deferLiveThreadUpdate(runtime, publishLiveThreadUpdate, {
      requireStreaming: event.message.role === 'toolResult',
    })
  }
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy)
}

function handleRuntimeAgentEnd(runtime: PiRuntime, runtimeKey: string | null) {
  cancelLiveThreadUpdate(runtime)
  void publishThreadUpdate(runtime, 'end')
  if (runtimeKey && settingsRefreshController.isStale(runtimeKey))
    void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => undefined)
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy)
}

function handleRuntimeCompactionEnd(runtime: PiRuntime, runtimeKey: string | null) {
  setTimeout(() => {
    cancelLiveThreadUpdate(runtime)
    void publishThreadUpdate(runtime, 'compaction')
    void publishRuntimeComposerState(runtime)
  }, 0)
  if (runtimeKey && settingsRefreshController.isStale(runtimeKey))
    void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => undefined)
}

function handleRuntimeToolEvent(
  runtime: PiRuntime,
  event: Extract<
    RuntimeSessionEvent,
    { type: 'tool_execution_start' | 'tool_execution_update' | 'tool_execution_end' }
  >,
) {
  rememberRuntimeToolProgress(runtime, {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: 'args' in event ? event.args : undefined,
    partialResult: getRuntimeToolProgressPartial(event),
    isError: event.type === 'tool_execution_end' ? event.isError : false,
    terminal: event.type === 'tool_execution_end',
  })
  scheduleLiveThreadUpdate(runtime, publishLiveThreadUpdate)
}

function handleRuntimeSessionEvent(runtime: PiRuntime, event: RuntimeSessionEvent) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) suspendRuntimeDisposal(runtimeKey)
  if (event.type === 'message_start' || event.type === 'message_update')
    return scheduleLiveThreadUpdate(runtime, publishLiveThreadUpdate)
  if (event.type === 'message_end') return handleRuntimeMessageEnd(runtime, runtimeKey, event)
  if (event.type === 'agent_end') return handleRuntimeAgentEnd(runtime, runtimeKey)
  if (event.type === 'compaction_start') {
    cancelLiveThreadUpdate(runtime)
    void publishThreadUpdate(runtime, 'compaction-start')
    void publishRuntimeComposerState(runtime)
    return
  }
  if (event.type === 'compaction_end') return handleRuntimeCompactionEnd(runtime, runtimeKey)
  if (
    event.type === 'tool_execution_start' ||
    event.type === 'tool_execution_update' ||
    event.type === 'tool_execution_end'
  )
    return handleRuntimeToolEvent(runtime, event)
  if (event.type === 'queue_update')
    void publishRuntimeComposerState(runtime).finally(() => {
      if (runtimeKey && !runtime.session.isStreaming)
        scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy)
    })
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
    createAgentSession,
    getAgentDir,
  } = await getPiModule()
  const agentDir = getAgentDir()
  const authStorage = AuthStorage.create()
  const modelRegistry = normalizeModelRegistryContextWindows(
    ModelRegistry.create(authStorage, `${agentDir}/models.json`),
  )
  const settingsManager = createRuntimeSettingsManager({
    SettingsManager,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
  })
  const sessionDir = options.sessionDir ?? settingsManager.getSessionDir() ?? undefined
  const resourceLoader = await createIsolatedRuntimeResourceLoader({
    DefaultResourceLoader,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    settingsManager,
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
    ...(resourceLoader ? { resourceLoader } : {}),
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

  session.subscribe((event) => handleRuntimeSessionEvent(runtime, event))

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

  const settingsCwd = normalizeSettingsCwd(options.settingsCwd)
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
  options: { chatGroupId?: string | undefined | null | undefined } = {},
) {
  const runtime = await createRuntime({
    cwd,
    sessionDir,
    settingsCwd: sessionDir ?? null,
    chatGroupId: options.chatGroupId ?? null,
  })
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
