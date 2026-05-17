const extensionSourceSuffixPattern = /\.(ts|js)$/

import path from 'node:path'
import { normalizeModelRegistryContextWindows } from '../../shared/model-context-window-normalization.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { ensureAskQuestionsExtensionRuntimePath } from '../native-extensions/ask-questions-extension-path.ts'
import { getPiModule } from '../pi-module.ts'
import {
  abortHeadlessExtensionCommand,
  bindHeadlessAgentSessionExtensions,
  isHeadlessExtensionCommandRunning,
  refreshHeadlessAgentSessionExtensionBindings,
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
import { emitDesktopEvent } from './host-events.ts'
import { publishComposerUpdate } from './live-thread-publisher.ts'
import { invokeMainRequest } from './main-request-client.ts'
import { createNativeAskQuestionsTools } from './native-ask-questions-tool.ts'
import { handleRuntimeSessionEvent } from './runtime-session-events.ts'

function getRuntimeDiagnosticExtensionLabel(extensionPath: string) {
  if (extensionPath.startsWith('command:')) return `/${extensionPath.slice('command:'.length)}`
  if (extensionPath.startsWith('<')) return extensionPath.replace(/[<>]/g, '')
  return path.basename(extensionPath).replace(extensionSourceSuffixPattern, '')
}

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>
  disposeTimeout: ReturnType<typeof setTimeout> | null
  settingsCwd: string | null
}

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000

const runtimeRecords = new Map<string, RuntimeRecord>()
const runtimeMutationTails = new Map<string, Promise<void>>()
const staleRuntimeGenerations = new Map<string, number>()

async function disposeRuntimeIfIdle(runtimeKey: string, record: RuntimeRecord) {
  const currentRecord = runtimeRecords.get(runtimeKey)
  if (!currentRecord || currentRecord !== record) return
  try {
    const runtime = await record.runtimePromise
    if (
      runtime.session.isStreaming ||
      runtime.session.isCompacting ||
      isRuntimeExtensionCommandRunning(runtime)
    ) {
      scheduleRuntimeDisposal(runtimeKey)
      return
    }
    runtime.session.dispose()
  } finally {
    if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey)
    staleRuntimeGenerations.delete(runtimeKey)
  }
}

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey)
  if (!record?.disposeTimeout) return
  clearTimeout(record.disposeTimeout)
  record.disposeTimeout = null
}

export function suspendRuntimeDisposal(runtimeKey: string) {
  clearRuntimeDisposeTimeout(runtimeKey)
}

export function scheduleRuntimeDisposal(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey)
  if (!record) return
  clearRuntimeDisposeTimeout(runtimeKey)
  record.disposeTimeout = setTimeout(() => {
    void disposeRuntimeIfIdle(runtimeKey, record)
  }, RUNTIME_IDLE_TIMEOUT_MS)
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
    defineTool,
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
    systemPrompt: getRuntimeSystemPrompt({ settingsCwd: options.settingsCwd }),
  })
  let runtime: PiRuntime | null = null
  const enabledNativeExtensions = await getEnabledNativeExtensionsForRuntime(
    options.sessionManager ? { sessionManager: options.sessionManager } : {},
  )
  const nativeAskQuestionTools = enabledNativeExtensions.includes('askQuestions')
    ? await createNativeAskQuestionsTools({
        defineTool,
        extensionPath: ensureAskQuestionsExtensionRuntimePath() ?? '',
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
      reloadRuntimeSettingsIfSafe,
      scheduleRuntimeDisposal,
      suspendRuntimeDisposal,
    }),
  )

  await bindHeadlessAgentSessionExtensions(session, {
    onExtensionCommandStateChange: () => {
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .catch((error) => console.warn('Failed to publish extension command state', error))
      if (!isRuntimeExtensionCommandRunning(runtime)) {
        const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
        if (runtimeKey) {
          void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
            // Keep stale settings marked; the next safe point retries silently.
          })
        }
      }
    },
    onExtensionError: (error) => {
      const extensionLabel = getRuntimeDiagnosticExtensionLabel(error.extensionPath)
      emitDesktopEvent({
        type: 'runtime-diagnostic',
        severity: 'error',
        message: `${extensionLabel} extension error: ${error.error}`,
        details: { ...error, extensionLabel },
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile ?? null,
      })
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
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .catch((error) => console.warn('Failed to publish extension command state', error))
      if (!isRuntimeExtensionCommandRunning(runtime)) {
        const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
        if (runtimeKey) {
          void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
            // Keep stale settings marked; the next safe point retries silently.
          })
        }
      }
    },
  })
}

function normalizeSettingsCwd(settingsCwd?: string | undefined | null | undefined) {
  return settingsCwd ? path.resolve(settingsCwd) : null
}

function registerRuntime(
  runtimeKey: string,
  runtimePromise: Promise<PiRuntime>,
  settingsCwd?: string | undefined | null | undefined,
) {
  staleRuntimeGenerations.delete(runtimeKey)
  const record: RuntimeRecord = {
    runtimePromise,
    disposeTimeout: null,
    settingsCwd: normalizeSettingsCwd(settingsCwd),
  }
  runtimeRecords.set(runtimeKey, record)
  return record
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  return persistedSessionPath
    ? (runtimeRecords.get(persistedSessionPath)?.runtimePromise ?? null)
    : null
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
  if (!persistedSessionPath)
    throw new Error('A persisted session path is required to open a live runtime.')
  const settingsCwd = normalizeSettingsCwd(options.settingsCwd)
  const existingRuntime = runtimeRecords.get(persistedSessionPath)
  if (existingRuntime) {
    if (existingRuntime.settingsCwd === settingsCwd) {
      if (options.suspendDisposal) suspendRuntimeDisposal(persistedSessionPath)
      return await existingRuntime.runtimePromise
    } else {
      const runtime = await existingRuntime.runtimePromise
      runtime.session.dispose()
      runtimeRecords.delete(persistedSessionPath)
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
    if (record && runtimeRecords.get(persistedSessionPath) === record)
      runtimeRecords.delete(persistedSessionPath)
    staleRuntimeGenerations.delete(persistedSessionPath)
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
    registerRuntime(runtimeKey, Promise.resolve(runtime), sessionDir ?? null)
  }
  return runtime
}

export async function withRuntimeMutationLock<T>(runtimeKey: string, task: () => Promise<T>) {
  const previousTail = runtimeMutationTails.get(runtimeKey) ?? Promise.resolve()
  let releaseCurrentTail: (() => void) | undefined
  const currentTail = new Promise<void>((resolve) => {
    releaseCurrentTail = resolve
  })
  const nextTail = previousTail.then(() => currentTail)
  runtimeMutationTails.set(runtimeKey, nextTail)
  await previousTail
  try {
    return await task()
  } finally {
    releaseCurrentTail?.()
    if (runtimeMutationTails.get(runtimeKey) === nextTail) runtimeMutationTails.delete(runtimeKey)
  }
}

async function reloadRuntimeSettings(
  runtimeKey: string,
  runtime: PiRuntime,
  staleGeneration: number,
) {
  if (
    runtime.session.isStreaming ||
    runtime.session.isCompacting ||
    isRuntimeExtensionCommandRunning(runtime)
  )
    return false
  await runtime.session.reload()
  await refreshRuntimeExtensionBindings(runtime)
  const composer = await buildComposerState(runtime)
  publishComposerUpdate(composer, {
    projectId: runtime.cwd,
    sessionPath: runtime.session.sessionFile ?? null,
  })
  if (staleRuntimeGenerations.get(runtimeKey) === staleGeneration) {
    staleRuntimeGenerations.delete(runtimeKey)
  }
  return true
}

export async function reloadRuntimeSettingsIfSafe(
  sessionPath: string,
  options: { useMutationLock?: boolean | undefined } = {},
): Promise<boolean> {
  const runtimeKey = getPersistedSessionPath(sessionPath)
  if (!runtimeKey) return false
  const staleGeneration = staleRuntimeGenerations.get(runtimeKey)
  if (staleGeneration === undefined) return false

  if (options.useMutationLock ?? true) {
    return await withRuntimeMutationLock(runtimeKey, () =>
      reloadRuntimeSettingsIfSafe(runtimeKey, { useMutationLock: false }),
    )
  }

  const runtimePromise = getCachedRuntimeForSessionPath(runtimeKey)
  if (!runtimePromise) {
    if (staleRuntimeGenerations.get(runtimeKey) === staleGeneration) {
      staleRuntimeGenerations.delete(runtimeKey)
    }
    return false
  }

  try {
    return await reloadRuntimeSettings(runtimeKey, await runtimePromise, staleGeneration)
  } catch {
    // Keep stale; next safe point retries.
    return false
  }
}

async function markRuntimeRecordStale(runtimeKey: string, record: RuntimeRecord) {
  staleRuntimeGenerations.set(runtimeKey, (staleRuntimeGenerations.get(runtimeKey) ?? 0) + 1)
  clearRuntimeDisposeTimeout(runtimeKey)
  try {
    await record.runtimePromise
  } catch {
    if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey)
    staleRuntimeGenerations.delete(runtimeKey)
    return
  }
  await reloadRuntimeSettingsIfSafe(runtimeKey)
}

export async function invalidateRuntimeSettings(
  request: {
    sessionPath?: string | undefined | null | undefined
    projectPath?: string | undefined | null | undefined
  } = {},
) {
  const sessionPath = getPersistedSessionPath(request.sessionPath)
  if (sessionPath) {
    const record = runtimeRecords.get(sessionPath)
    if (record) await markRuntimeRecordStale(sessionPath, record)
    return { ok: true as const }
  }

  const projectPath = request.projectPath?.trim() || null
  const resolvedProjectPath = projectPath ? path.resolve(projectPath) : null
  const entries = [...runtimeRecords.entries()]
  await Promise.all(
    entries.map(async ([runtimeKey, record]) => {
      let runtime: PiRuntime
      try {
        runtime = await record.runtimePromise
      } catch {
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey)
        staleRuntimeGenerations.delete(runtimeKey)
        return
      }
      if (resolvedProjectPath && path.resolve(runtime.cwd) !== resolvedProjectPath) return
      await markRuntimeRecordStale(runtimeKey, record)
    }),
  )
  return { ok: true as const }
}

export async function disposeAllRuntimeHosts() {
  const entries = [...runtimeRecords.entries()]
  runtimeRecords.clear()
  staleRuntimeGenerations.clear()
  await Promise.all(
    entries.map(async ([runtimeKey, record]) => {
      clearRuntimeDisposeTimeout(runtimeKey)
      try {
        ;(await record.runtimePromise).session.dispose()
      } catch {
        // Ignore shutdown races.
      }
    }),
  )
}
