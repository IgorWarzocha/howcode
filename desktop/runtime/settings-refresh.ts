import path from 'node:path'
import type { ComposerState } from '../../shared/desktop-contracts'
import { getPersistedSessionPath } from '../../shared/session-paths'
import type { PiRuntime } from './types.ts'

export type RuntimeRecordSnapshot = {
  runtimeKey: string
  runtimePromise: Promise<PiRuntime>
  settingsCwd: string | null
}

type RuntimeSettingsRefreshControllerOptions = {
  getCachedRuntimeForSessionPath: (sessionPath: string) => Promise<PiRuntime> | null
  getRuntimeRecords: () => RuntimeRecordSnapshot[]
  withRuntimeMutationLock: <T>(runtimeKey: string, task: () => Promise<T>) => Promise<T>
  afterReload?: (runtime: PiRuntime) => Promise<void>
  isRuntimeBusy?: (runtime: PiRuntime) => boolean
  buildComposerState: (runtime: PiRuntime) => Promise<ComposerState>
  publishComposerUpdate: (
    composer: ComposerState,
    selection: { projectId: string | null; sessionPath: string | null },
  ) => void
}

export function isRuntimeBusy(runtime: PiRuntime) {
  return runtime.session.isStreaming || runtime.session.isCompacting
}

async function reloadRuntimeUntilStable(input: {
  isRuntimeBusy: (runtime: PiRuntime) => boolean
  reloadRuntimeSettings: (runtimeKey: string, runtime: PiRuntime) => Promise<boolean>
  runtime: PiRuntime
  runtimeKey: string
  staleGenerations: Map<string, number>
}) {
  let reloaded = false
  let reloadedGeneration: number | null = null
  while (!input.isRuntimeBusy(input.runtime)) {
    const generation = input.staleGenerations.get(input.runtimeKey)
    if (generation === undefined) break
    const didReload = await input.reloadRuntimeSettings(input.runtimeKey, input.runtime)
    if (!didReload) break
    reloaded = true
    reloadedGeneration = generation
    if (input.staleGenerations.get(input.runtimeKey) === generation) break
  }
  return { reloaded, reloadedGeneration }
}

async function publishReloadedComposer(input: {
  buildComposerState: (runtime: PiRuntime) => Promise<ComposerState>
  publishComposerUpdate: RuntimeSettingsRefreshControllerOptions['publishComposerUpdate']
  reloadedGeneration: number | null
  runtime: PiRuntime
  runtimeKey: string
  staleGenerations: Map<string, number>
}) {
  const composer = await input.buildComposerState(input.runtime)
  input.publishComposerUpdate(composer, {
    projectId: input.runtime.cwd,
    sessionPath: input.runtime.session.sessionFile ?? null,
  })
  if (
    input.reloadedGeneration !== null &&
    input.staleGenerations.get(input.runtimeKey) === input.reloadedGeneration
  ) {
    input.staleGenerations.delete(input.runtimeKey)
  }
}

export function createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords,
  withRuntimeMutationLock,
  afterReload,
  isRuntimeBusy: isRuntimeBusyOption = isRuntimeBusy,
  buildComposerState,
  publishComposerUpdate,
}: RuntimeSettingsRefreshControllerOptions) {
  const staleGenerations = new Map<string, number>()
  const activeReloads = new Map<string, Promise<void>>()

  async function reloadRuntimeSettings(runtimeKey: string, runtime: PiRuntime) {
    if (isRuntimeBusyOption(runtime)) {
      return false
    }

    const existingReload = activeReloads.get(runtimeKey)
    if (existingReload) {
      await existingReload
      return false
    }

    const reload = runtime.session
      .reload()
      .then(() => afterReload?.(runtime))
      .then(() => undefined)
      .finally(() => {
        if (activeReloads.get(runtimeKey) === reload) {
          activeReloads.delete(runtimeKey)
        }
      })

    activeReloads.set(runtimeKey, reload)
    await reload
    return true
  }

  async function reloadIfSafe(
    sessionPath: string,
    options: { useMutationLock?: boolean | undefined } = {},
  ): Promise<boolean> {
    const runtimeKey = getPersistedSessionPath(sessionPath)
    if (!(runtimeKey && staleGenerations.has(runtimeKey))) {
      return false
    }

    if (options.useMutationLock ?? true) {
      return await withRuntimeMutationLock(runtimeKey, () =>
        reloadIfSafe(runtimeKey, { useMutationLock: false }),
      )
    }

    const runtimePromise = getCachedRuntimeForSessionPath(runtimeKey)
    if (!runtimePromise) {
      staleGenerations.delete(runtimeKey)
      return false
    }

    const runtime = await runtimePromise
    try {
      const { reloaded, reloadedGeneration } = await reloadRuntimeUntilStable({
        isRuntimeBusy: isRuntimeBusyOption,
        reloadRuntimeSettings,
        runtime,
        runtimeKey,
        staleGenerations,
      })

      if (reloaded) {
        await publishReloadedComposer({
          buildComposerState,
          publishComposerUpdate,
          reloadedGeneration,
          runtime,
          runtimeKey,
          staleGenerations,
        })
      }
      return reloaded
    } catch {
      // Keep the stale mark; the next safe point retries silently.
      return false
    }
  }

  function markStale(sessionPath: string | null | undefined) {
    const runtimeKey = getPersistedSessionPath(sessionPath ?? null)
    if (!runtimeKey) {
      return
    }

    staleGenerations.set(runtimeKey, (staleGenerations.get(runtimeKey) ?? 0) + 1)
    void reloadIfSafe(runtimeKey).catch(() => undefined)
  }

  function markStaleForProject(projectPath?: string | undefined | null | undefined) {
    if (projectPath !== null && projectPath !== undefined && projectPath.trim().length === 0) {
      return
    }

    const normalizedProjectPath = projectPath ? path.resolve(projectPath) : ''
    for (const { runtimeKey, runtimePromise } of getRuntimeRecords()) {
      void (async () => {
        try {
          const runtime = await runtimePromise
          if (normalizedProjectPath && path.resolve(runtime.cwd) !== normalizedProjectPath) {
            return
          }

          staleGenerations.set(runtimeKey, (staleGenerations.get(runtimeKey) ?? 0) + 1)
          await reloadIfSafe(runtimeKey)
        } catch {
          // Ignore stale runtime reload failures; a later refresh will retry.
        }
      })()
    }
  }

  function markStaleForSettingsCwd(settingsCwd?: string | undefined | null | undefined) {
    if (!settingsCwd?.trim()) return
    const normalizedSettingsCwd = path.resolve(settingsCwd)

    for (const { runtimeKey, settingsCwd: runtimeSettingsCwd } of getRuntimeRecords()) {
      if (!runtimeSettingsCwd || path.resolve(runtimeSettingsCwd) !== normalizedSettingsCwd) {
        continue
      }

      staleGenerations.set(runtimeKey, (staleGenerations.get(runtimeKey) ?? 0) + 1)
      void reloadIfSafe(runtimeKey).catch(() => undefined)
    }
  }

  function isStale(sessionPath: string | null | undefined) {
    const runtimeKey = getPersistedSessionPath(sessionPath ?? null)
    return Boolean(runtimeKey && staleGenerations.has(runtimeKey))
  }

  return { isStale, markStale, markStaleForProject, markStaleForSettingsCwd, reloadIfSafe }
}
