import { randomUUID } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import nodePath from 'node:path'
import type {
  ProjectDiffBaseline,
  ProjectDiffImagePreview,
  ProjectDiffImageSide,
  ProjectDiffResult,
  ProjectDiffStatsResult,
  ProjectDiffStreamStartResult,
} from '../../shared/desktop-contracts.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import {
  countNonEmptyLines,
  loadCommitContextOutputsForMode,
  parseShortStat,
} from './commit-message-context.ts'
import { formatGitCommandError, runGitBufferWithOptions } from './git-runner.ts'
import { resolveProjectDiffBaseline } from './project-diff-baselines.ts'
import { isGitRepository } from './project-state.ts'
import type { CommitMessageContext } from './types.ts'
import { loadWorktreeSnapshot, loadWorktreeStats } from './worktree-snapshot.ts'

const maxDiffImagePreviewBytes = 12 * 1024 * 1024
const fileExtensionPattern = /\.[^./]+$/
const leadingSlashPattern = /^\/+/
const activeProjectDiffStreams = new Map<string, AbortController>()
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

async function readWorktreeFile(projectId: string, filePath: string) {
  const [projectRoot, candidatePath] = await Promise.all([
    realpath(projectId),
    realpath(nodePath.resolve(projectId, filePath)),
  ])
  const relativePath = nodePath.relative(projectRoot, candidatePath)
  if (relativePath.startsWith('..') || nodePath.isAbsolute(relativePath)) {
    return null
  }

  const fileStat = await stat(candidatePath)
  if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > maxDiffImagePreviewBytes) {
    return null
  }

  return await readFile(candidatePath)
}

async function readGitObject(projectId: string, revision: string, filePath: string) {
  const { stdout } = await runGitBufferWithOptions(projectId, ['show', `${revision}:${filePath}`], {
    timeout: 10_000,
    maxBuffer: maxDiffImagePreviewBytes,
  })

  return stdout
}

export async function loadProjectDiffImagePreview({
  projectId,
  baseline,
  path,
  side,
}: {
  projectId: string
  baseline?: ProjectDiffBaseline | null | undefined
  path: string
  side: ProjectDiffImageSide
}): Promise<ProjectDiffImagePreview> {
  if (!(await isGitRepository(projectId))) {
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
            projectId,
            (await resolveProjectDiffBaseline(projectId, baseline)).rev,
            normalizedPath,
          )
        : await readWorktreeFile(projectId, normalizedPath)
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
  projectId: string,
  includeUnstaged: boolean,
  includeUntracked = false,
): Promise<CommitMessageContext | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  const outputs = await loadCommitContextOutputsForMode(
    projectId,
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
    projectId,
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

export async function startProjectDiffStream(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
  requestedStreamId?: string | null,
  includeUntracked = false,
): Promise<ProjectDiffStreamStartResult> {
  const streamId = requestedStreamId?.trim() || randomUUID()
  activeProjectDiffStreams.get(streamId)?.abort()
  const abortController = new AbortController()
  activeProjectDiffStreams.set(streamId, abortController)
  void (async () => {
    try {
      if (!(await isGitRepository(projectId))) {
        emitDesktopEvent({
          type: 'project-diff-stream',
          event: { type: 'complete', streamId, projectId, result: null },
        })
        return
      }

      let sequence = 0
      const resolvedBaseline = await resolveProjectDiffBaseline(projectId, baseline)
      const snapshot = await loadWorktreeSnapshot(projectId, {
        baselineRev: resolvedBaseline.rev,
        includeUntracked,
        signal: abortController.signal,
        onPatchChunk: (chunk) => {
          if (abortController.signal.aborted) return
          emitDesktopEvent({
            type: 'project-diff-stream',
            event: { type: 'chunk', streamId, projectId, sequence: sequence++, chunk },
          })
        },
      })

      if (abortController.signal.aborted) return

      emitDesktopEvent({
        type: 'project-diff-stream',
        event: {
          type: 'complete',
          streamId,
          projectId,
          result: {
            projectId,
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
        type: 'project-diff-stream',
        event: {
          type: 'error',
          streamId,
          projectId,
          error: `Could not load worktree diff: ${formatGitCommandError(error)}`,
        },
      })
    } finally {
      if (activeProjectDiffStreams.get(streamId) === abortController) {
        activeProjectDiffStreams.delete(streamId)
      }
    }
  })()

  return { streamId }
}

export async function cancelProjectDiffStream(streamId: string): Promise<void> {
  const normalizedStreamId = streamId.trim()
  const stream = activeProjectDiffStreams.get(normalizedStreamId)
  if (!stream) return
  activeProjectDiffStreams.delete(normalizedStreamId)
  stream.abort()
}

export async function loadProjectDiff(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
  includeUntracked = false,
): Promise<ProjectDiffResult | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  try {
    const resolvedBaseline = await resolveProjectDiffBaseline(projectId, baseline)
    const snapshot = await loadWorktreeSnapshot(projectId, {
      baselineRev: resolvedBaseline.rev,
      includeUntracked,
    })

    return {
      projectId,
      diff: snapshot.patch,
      fileCount: snapshot.fileCount,
      insertions: snapshot.insertions,
      deletions: snapshot.deletions,
      baseline: baseline ?? { kind: 'head' },
      resolvedBaseline,
    }
  } catch (error) {
    throw new Error(`Could not load worktree diff: ${formatGitCommandError(error)}`)
  }
}

export async function loadProjectDiffStats(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
  includeUntracked = false,
): Promise<ProjectDiffStatsResult | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  try {
    const resolvedBaseline = await resolveProjectDiffBaseline(projectId, baseline)
    const stats = await loadWorktreeStats(projectId, {
      baselineRev: resolvedBaseline.rev,
      includeUntracked,
    })

    return {
      projectId,
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
