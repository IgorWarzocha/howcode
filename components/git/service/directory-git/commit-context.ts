import { randomUUID } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import nodePath from 'node:path'
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
import { formatGitCommandError, runGitBufferWithOptions } from './git-runner.ts'
import type { CommitMessageContext } from './types.ts'
import { loadWorktreeSnapshot, loadWorktreeStats } from './worktree-snapshot.ts'

const maxDiffImagePreviewBytes = 12 * 1024 * 1024
const fileExtensionPattern = /\.[^./]+$/
const leadingSlashPattern = /^\/+/
const activeDirectoryDiffStreams = new Map<string, AbortController>()
const directoryDiffTasks = new Set<Promise<void>>()
const imageMimeTypesByExtension: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function getImageMimeType(filePath: string) {
  const match = filePath.toLowerCase().match(fileExtensionPattern)
  return match ? imageMimeTypesByExtension[match[0] ?? ''] : undefined
}

function normalizeGitImagePath(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/').replace(leadingSlashPattern, '')
  return normalized.length > 0 && !normalized.includes('\0') ? normalized : null
}

function isMissingNamedBranchBaseline(error: unknown) {
  const message = formatGitCommandError(error)
  return message === 'Could not find dev branch.' || message === 'Could not find main branch.'
}

async function readWorktreeFile(directoryId: string, filePath: string) {
  const [directoryRoot, candidatePath] = await Promise.all([
    realpath(directoryId),
    realpath(nodePath.resolve(directoryId, filePath)),
  ])
  const relativePath = nodePath.relative(directoryRoot, candidatePath)
  if (relativePath.startsWith('..') || nodePath.isAbsolute(relativePath)) {
    return null
  }

  const fileStat = await stat(candidatePath)
  if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > maxDiffImagePreviewBytes) {
    return null
  }

  return await readFile(candidatePath)
}

async function readGitObject(directoryId: string, revision: string, filePath: string) {
  const { stdout } = await runGitBufferWithOptions(
    directoryId,
    ['show', `${revision}:${filePath}`],
    {
      timeout: 10_000,
      maxBuffer: maxDiffImagePreviewBytes,
    },
  )

  return stdout
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

  const normalizedPath = normalizeGitImagePath(path)
  const mimeType = normalizedPath ? getImageMimeType(normalizedPath) : undefined
  if (!(normalizedPath && mimeType)) {
    return null
  }

  try {
    const content =
      side === 'old'
        ? await readGitObject(
            directoryId,
            (await resolveDirectoryDiffBaseline(directoryId, baseline)).rev,
            normalizedPath,
          )
        : await readWorktreeFile(directoryId, normalizedPath)
    if (!content) return null
    if (content.length <= 0 || content.length > maxDiffImagePreviewBytes) {
      return null
    }

    return {
      side,
      mimeType,
      dataUrl: `data:${mimeType};base64,${content.toString('base64')}`,
    }
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
      const snapshot = await loadWorktreeSnapshot(directoryId, {
        baselineRev: resolvedBaseline.rev,
        includeUntracked: includeUntracked === true,
        signal: abortController.signal,
        onPatchChunk: (chunk) => {
          if (abortController.signal.aborted) return
          emitDesktopEvent({
            type: 'directory-diff-stream',
            event: { type: 'chunk', streamId, directoryId, sequence: sequence++, chunk },
          })
        },
      })

      if (abortController.signal.aborted) return

      emitDesktopEvent({
        type: 'directory-diff-stream',
        event: {
          type: 'complete',
          streamId,
          directoryId,
          result: {
            directoryId,
            diff: snapshot.patch,
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
    const stats = await loadWorktreeStats(directoryId, {
      baselineRev: resolvedBaseline.rev,
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
