import path from 'node:path'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { getPiModule } from '../pi-module.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import { normalizeRuntimeSettingsCwd } from '../runtime/runtime-settings-cwd.ts'
import type { PiRuntime } from '../runtime/types.ts'
import {
  abortRuntimeExtensionCommand,
  createLiveRuntime,
  isRuntimeExtensionCommandRunning,
  refreshRuntimeExtensionBindings as refreshRuntimeExtensionBindingsWithReload,
} from './live-runtime-factory.ts'
import { publishComposerUpdate } from './live-thread-publisher.ts'

export { abortRuntimeExtensionCommand, isRuntimeExtensionCommandRunning }

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>
  disposeTimeout: ReturnType<typeof setTimeout> | null
  settingsCwd: string | null
}

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000

const runtimeRecords = new Map<string, RuntimeRecord>()
const runtimeMutationTails = new Map<string, Promise<void>>()
const staleRuntimeGenerations = new Map<string, number>()

const liveRuntimeFactoryHandlers = {
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
  suspendRuntimeDisposal,
}

export async function refreshRuntimeExtensionBindings(runtime: PiRuntime) {
  await refreshRuntimeExtensionBindingsWithReload(runtime, reloadRuntimeSettingsIfSafe)
}

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

function registerRuntime(
  runtimeKey: string,
  runtimePromise: Promise<PiRuntime>,
  settingsCwd?: string | undefined | null | undefined,
) {
  staleRuntimeGenerations.delete(runtimeKey)
  const record: RuntimeRecord = {
    runtimePromise,
    disposeTimeout: null,
    settingsCwd: normalizeRuntimeSettingsCwd(settingsCwd),
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
  const settingsCwd = normalizeRuntimeSettingsCwd(options.settingsCwd)
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
  const runtimePromise = createLiveRuntime(
    {
      cwd: sessionManager.getCwd(),
      settingsCwd,
      chatGroupId: options.chatGroupId ?? null,
      sessionManager,
    },
    liveRuntimeFactoryHandlers,
  ).catch((error) => {
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
  options: {
    branchName?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
  } = {},
) {
  const runtime = await createLiveRuntime(
    {
      cwd,
      sessionDir,
      settingsCwd: sessionDir ?? null,
      chatGroupId: options.chatGroupId ?? null,
    },
    liveRuntimeFactoryHandlers,
  )
  runtime.branchName = options.branchName ?? null
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

function shouldDisposeRuntime(input: {
  projectPath: string | null
  runtime: PiRuntime
  runtimeKey: string
  sessionPaths: Set<string>
}) {
  if (input.sessionPaths.has(input.runtimeKey)) return true
  return Boolean(input.projectPath && path.resolve(input.runtime.cwd) === input.projectPath)
}

async function disposeRuntimeRecord(runtimeKey: string, record: RuntimeRecord, runtime: PiRuntime) {
  clearRuntimeDisposeTimeout(runtimeKey)
  if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey)
  staleRuntimeGenerations.delete(runtimeKey)
  try {
    abortRuntimeExtensionCommand(runtime)
    if (runtime.session.isStreaming || runtime.session.isCompacting) await runtime.session.abort()
  } catch {
    // Continue disposal; the workspace is being torn down.
  }
  try {
    runtime.session.dispose()
  } catch {
    // Ignore shutdown races.
  }
}

export async function disposeRuntimeHosts(
  request: {
    sessionPaths?: string[] | undefined
    projectPath?: string | undefined | null | undefined
  } = {},
) {
  const sessionPaths = new Set(
    (request.sessionPaths ?? [])
      .map((sessionPath) => getPersistedSessionPath(sessionPath))
      .filter((sessionPath): sessionPath is string => Boolean(sessionPath)),
  )
  const projectPath = request.projectPath?.trim() ? path.resolve(request.projectPath) : null
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
      if (!shouldDisposeRuntime({ projectPath, runtime, runtimeKey, sessionPaths })) return

      await disposeRuntimeRecord(runtimeKey, record, runtime)
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
