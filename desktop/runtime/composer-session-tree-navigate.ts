import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import {
  publishComposerUpdate,
  publishThreadUpdate,
} from '../runtime-host/live-thread-publisher.ts'
import { applyComposerModeSettings } from './composer-mode-settings.ts'
import { buildComposerState } from './composer-state.ts'
import {
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  isRuntimeExtensionCommandRunning,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposalForRuntime,
  withRuntimeMutationLock,
} from './runtime-registry.ts'
import type { PiRuntime, RuntimeThreadReason } from './types.ts'

export type NavigateSessionTreeOutcome = {
  cancelled: boolean
  aborted?: boolean
  editorText?: string
}

const navigateTreeAdapters = {
  emitComposerUpdate: async (request?: ComposerStateRequest) => {
    const persistedSessionPath = getPersistedSessionPath(request?.sessionPath ?? null)
    const runtimePromise = persistedSessionPath
      ? getCachedRuntimeForSessionPath(persistedSessionPath)
      : null
    const runtime = runtimePromise ? await runtimePromise : null
    if (!runtime) return
    const composer = await buildComposerState(runtime)
    publishComposerUpdate(composer, {
      projectId: request?.projectId ?? runtime.cwd,
      sessionPath: persistedSessionPath,
    })
  },
  isRuntimeExtensionCommandRunning,
  publishThreadUpdate,
  scheduleRuntimeDisposal: scheduleRuntimeDisposalForRuntime,
}

function assertNavigateAllowed(runtime: PiRuntime) {
  if (navigateTreeAdapters.isRuntimeExtensionCommandRunning(runtime)) {
    throw new Error(
      'Wait for the current extension command to finish before changing the session tree.',
    )
  }
  if (runtime.session.isStreaming) {
    throw new Error('Wait for the current response to finish before changing the session tree.')
  }
  if (runtime.session.isCompacting) {
    throw new Error('Wait for the current compaction or branch summary to finish.')
  }
}

async function publishNavigateCompactionStarted(runtime: PiRuntime) {
  await navigateTreeAdapters.publishThreadUpdate(runtime, 'compaction-start')
  await navigateTreeAdapters.emitComposerUpdate({
    projectId: runtime.cwd,
    sessionPath: runtime.session.sessionFile ?? null,
  })
}

async function runNavigateOnRuntime(
  runtime: PiRuntime,
  targetEntryId: string,
  summarize: boolean,
  label?: string | undefined,
): Promise<NavigateSessionTreeOutcome> {
  assertNavigateAllowed(runtime)
  const leafId = runtime.session.sessionManager.getLeafId()
  if (targetEntryId === leafId) {
    return { cancelled: false }
  }

  const trimmedLabel = label?.trim() || undefined
  const branchSummaryIdsBeforeNavigate = collectBranchSummaryIds(runtime)
  const navigateStartedAt = Date.now()
  const navigatePromise = runtime.session.navigateTree(targetEntryId, {
    summarize,
    ...(trimmedLabel ? { label: trimmedLabel } : {}),
  })

  if (summarize) {
    let compactionUiPublished = false
    const ensureCompactionUi = async () => {
      if (compactionUiPublished) return
      compactionUiPublished = true
      await publishNavigateCompactionStarted(runtime)
    }

    if (runtime.session.isCompacting) await ensureCompactionUi()
    const started = await waitForBranchSummaryStartOrSettlement(runtime, navigatePromise)
    if (started === 'started') await ensureCompactionUi()
  }

  const result = await navigatePromise
  await ensureNavigateLabelApplied(runtime, {
    result,
    label: trimmedLabel,
    summarize,
    targetEntryId,
    branchSummaryIdsBeforeNavigate,
    navigateStartedAt,
  })
  await publishNavigateSettled(runtime, summarize ? 'compaction' : 'update')
  if (result.cancelled) {
    return { cancelled: true, ...(result.aborted ? { aborted: true } : {}) }
  }
  return {
    cancelled: false,
    ...(result.editorText === undefined ? {} : { editorText: result.editorText }),
  }
}

function ensureNavigateLabelApplied(
  runtime: PiRuntime,
  input: {
    result: { cancelled?: boolean; summaryEntry?: { id: string } | undefined }
    label?: string | undefined
    summarize: boolean
    targetEntryId: string
    branchSummaryIdsBeforeNavigate: ReadonlySet<string>
    navigateStartedAt: number
  },
) {
  if (input.result.cancelled || !input.label) return
  const labelTargetId = input.summarize
    ? (input.result.summaryEntry?.id ?? findNewBranchSummaryId(runtime, input))
    : input.targetEntryId
  if (!labelTargetId) return
  const existingLabel = runtime.session.sessionManager.getLabel?.(labelTargetId)?.trim()
  if (existingLabel === input.label) return
  runtime.session.sessionManager.appendLabelChange(labelTargetId, input.label)
}

function collectBranchSummaryIds(runtime: PiRuntime): Set<string> {
  return new Set(
    runtime.session.sessionManager
      .getEntries()
      .filter((entry) => entry.type === 'branch_summary')
      .map((entry) => entry.id),
  )
}

function findNewBranchSummaryId(
  runtime: PiRuntime,
  input: {
    branchSummaryIdsBeforeNavigate: ReadonlySet<string>
    navigateStartedAt: number
  },
): string | undefined {
  const newSummaries = runtime.session.sessionManager
    .getEntries()
    .filter((entry) => {
      if (entry.type !== 'branch_summary') return false
      if (input.branchSummaryIdsBeforeNavigate.has(entry.id)) return false
      return new Date(entry.timestamp).getTime() >= input.navigateStartedAt - 1_000
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return newSummaries[0]?.id
}

async function waitForBranchSummaryStartOrSettlement(
  runtime: PiRuntime,
  navigatePromise: Promise<{
    cancelled: boolean
    aborted?: boolean
    editorText?: string
    summaryEntry?: { id: string }
  }>,
) {
  if (runtime.session.isCompacting) return 'started' as const
  let pollId: ReturnType<typeof setInterval> | undefined
  try {
    return await Promise.race([
      navigatePromise.then(() => 'settled' as const),
      new Promise<'started'>((resolve) => {
        pollId = setInterval(() => {
          if (!runtime.session.isCompacting) return
          resolve('started')
        }, 50)
      }),
    ])
  } finally {
    if (pollId) clearInterval(pollId)
  }
}

async function publishNavigateSettled(
  runtime: PiRuntime,
  reason: Extract<RuntimeThreadReason, 'update' | 'compaction'>,
) {
  await navigateTreeAdapters.publishThreadUpdate(runtime, reason).catch((error) => {
    console.error('Session tree navigation settled but thread update publish failed', error)
  })
  await navigateTreeAdapters.emitComposerUpdate({
    projectId: runtime.cwd,
    sessionPath: runtime.session.sessionFile ?? null,
  })
}

export async function navigateSessionTree(input: {
  request: ComposerStateRequest
  targetEntryId: string
  summarize: boolean
  label?: string | undefined | null
}): Promise<NavigateSessionTreeOutcome> {
  const persistedSessionPath = getPersistedSessionPath(input.request.sessionPath)
  if (!persistedSessionPath) {
    throw new Error('Open a saved session before navigating the session tree.')
  }

  const targetEntryId = input.targetEntryId.trim()
  if (!targetEntryId) {
    throw new Error('Session tree entry is required.')
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: input.request.composerSessionDir ?? null,
      chatGroupId: input.request.chatGroupId ?? null,
    })
    runtime.branchName = input.request.branchName ?? runtime.branchName ?? null
    await applyComposerModeSettings(runtime, input.request)
    try {
      return await runNavigateOnRuntime(
        runtime,
        targetEntryId,
        input.summarize,
        input.label?.trim() || undefined,
      )
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime)
    }
  })
}
