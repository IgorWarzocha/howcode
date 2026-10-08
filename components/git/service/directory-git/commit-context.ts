import { randomUUID } from 'node:crypto'
import { emitDesktopEvent } from '../../../../desktop/runtime/desktop-events.ts'
import type {
  DirectoryDiffBaseline,
  DirectoryDiffImagePreview,
  DirectoryDiffImageSide,
  DirectoryDiffStatsResult,
  DirectoryDiffStreamStartResult,
} from '../../../../shared/desktop-contracts.ts'
import {
  countNonEmptyLines,
  loadCommitContextOutputsForMode,
  parseShortStat,
} from './commit-message-context.ts'
import { resolveDirectoryDiffBaseline } from './directory-diff-baselines.ts'
import { isGitRepository } from './directory-state.ts'
import { formatGitCommandError } from './git-runner.ts'
import { gitReader } from './native-reader.ts'
import type { CommitMessageContext } from './types.ts'

const activeDirectoryDiffStreams = new Map<string, AbortController>()
const directoryDiffTasks = new Set<Promise<void>>()

function isMissingNamedBranchBaseline(error: unknown) {
  const message = formatGitCommandError(error)
  return message === 'Could not find dev branch.' || message === 'Could not find main branch.'
}

export async function loadDirectoryDiffImagePreview({
  directoryId,
  baseline,
  path,
  side,
}: {
  directoryId: string
  baseline?: DirectoryDiffBaseline | null | undefined
  path: string
  side: DirectoryDiffImageSide
}): Promise<DirectoryDiffImagePreview> {
  if (!(await isGitRepository(directoryId))) {
    return null
  }

  try {
    return await gitReader.readImage({
      cwd: directoryId,
      baselineRevision:
        side === 'old' ? (await resolveDirectoryDiffBaseline(directoryId, baseline)).rev : '',
      path,
      side,
    })
  } catch {
    return null
  }
}

export function buildDefaultCommitMessage(context: { fileCount: number }) {
  if (context.fileCount <= 0) {
    return 'Update workspace'
  }

  return context.fileCount === 1 ? 'Update 1 file' : `Update ${context.fileCount} files`
}

export async function prepareCommitMessageContext(
  directoryId: string,
  includeUnstaged: boolean,
  includeUntracked = false,
): Promise<CommitMessageContext | null> {
  if (!(await isGitRepository(directoryId))) {
    return null
  }

  const outputs = await loadCommitContextOutputsForMode(
    directoryId,
    includeUnstaged,
    includeUntracked,
  )

  const {
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  } = outputs

  const shortStat = parseShortStat(shortStatOutput)
  const fileCount = Math.max(
    countNonEmptyLines(nameStatusOutput),
    countNonEmptyLines(numStatOutput),
  )

  if (fileCount <= 0) {
    return null
  }

  return {
    directoryId,
    branch,
    hasOrigin: originUrl !== null,
    includeUnstaged,
    includeUntracked,
    fileCount,
    insertions: shortStat.insertions,
    deletions: shortStat.deletions,
    nameStatus: nameStatusOutput,
    diffStat: diffStatOutput,
    numStat: numStatOutput,
    patch: patchOutput,
  }
}

export async function startDirectoryDiffStream(
  directoryId: string,
  baseline?: DirectoryDiffBaseline | null,
  requestedStreamId?: string | null,
  includeUntracked: boolean | null = false,
): Promise<DirectoryDiffStreamStartResult> {
  const streamId = requestedStreamId?.trim() || randomUUID()
  activeDirectoryDiffStreams.get(streamId)?.abort()
  const abortController = new AbortController()
  activeDirectoryDiffStreams.set(streamId, abortController)
  const task = (async () => {
    try {
      if (!(await isGitRepository(directoryId))) {
        emitDesktopEvent({
          type: 'directory-diff-stream',
          event: { type: 'complete', streamId, directoryId, result: null },
        })
        return
      }

      let sequence = 0
      const resolvedBaseline = await resolveDirectoryDiffBaseline(directoryId, baseline)
      const snapshot = await gitReader.diff(
        {
          cwd: directoryId,
          baseRevision: resolvedBaseline.rev,
          includeUntracked: includeUntracked === true,
        },
        {
          signal: abortController.signal,
          onChunk: (chunk) => {
            if (abortController.signal.aborted) return
            emitDesktopEvent({
              type: 'directory-diff-stream',
              event: { type: 'chunk', streamId, directoryId, sequence: sequence++, chunk },
            })
          },
        },
      )

      if (abortController.signal.aborted) return

      emitDesktopEvent({
        type: 'directory-diff-stream',
        event: {
          type: 'complete',
          streamId,
          directoryId,
          result: {
            directoryId,
            diff: snapshot.diff,
            fileCount: snapshot.fileCount,
            insertions: snapshot.insertions,
            deletions: snapshot.deletions,
            baseline: baseline ?? { kind: 'head' },
            resolvedBaseline,
          },
        },
      })
    } catch (error) {
      if (abortController.signal.aborted) return
      emitDesktopEvent({
        type: 'directory-diff-stream',
        event: {
          type: 'error',
          streamId,
          directoryId,
          error: `Could not load worktree diff: ${formatGitCommandError(error)}`,
        },
      })
    } finally {
      if (activeDirectoryDiffStreams.get(streamId) === abortController) {
        activeDirectoryDiffStreams.delete(streamId)
      }
    }
  })()
  directoryDiffTasks.add(task)
  void task.finally(() => directoryDiffTasks.delete(task))

  return { streamId }
}

export async function disposeDirectoryDiffStreams() {
  for (const controller of activeDirectoryDiffStreams.values()) controller.abort()
  await Promise.allSettled(directoryDiffTasks)
}

export async function cancelDirectoryDiffStream(streamId: string): Promise<void> {
  const normalizedStreamId = streamId.trim()
  const stream = activeDirectoryDiffStreams.get(normalizedStreamId)
  if (!stream) return
  activeDirectoryDiffStreams.delete(normalizedStreamId)
  stream.abort()
}

export async function loadDirectoryDiffStats(
  directoryId: string,
  baseline?: DirectoryDiffBaseline | null,
  includeUntracked: boolean | null = false,
): Promise<DirectoryDiffStatsResult | null> {
  if (!(await isGitRepository(directoryId))) {
    return null
  }

  try {
    const resolvedBaseline = await resolveDirectoryDiffBaseline(directoryId, baseline)
    const stats = await gitReader.stats({
      cwd: directoryId,
      baseRevision: resolvedBaseline.rev,
      includeUntracked: includeUntracked === true,
    })

    return {
      directoryId,
      fileCount: stats.fileCount,
      insertions: stats.insertions,
      deletions: stats.deletions,
      baseline: baseline ?? { kind: 'head' },
      resolvedBaseline,
    }
  } catch (error) {
    if (isMissingNamedBranchBaseline(error)) {
      return null
    }

    throw new Error(`Could not load worktree diff stats: ${formatGitCommandError(error)}`)
  }
}
