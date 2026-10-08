import type {
  DirectoryCommitEntry,
  DirectoryDiffBaseline,
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
  DirectoryDiffImagePreview,
  DirectoryDiffImageSide,
  DirectoryDiffStatsResult,
  DirectoryGitState,
} from '../../../src/app/desktop/types'
export async function getDirectoryGitStateQuery(
  directoryId: string,
): Promise<DirectoryGitState | null> {
  return (await window.piDesktop?.getDirectoryGitState?.(directoryId)) ?? null
}

export async function startDirectoryDiffStreamQuery(
  directoryId: string,
  baseline: DirectoryDiffBaseline | null = null,
  streamId: string | null = null,
  includeUntracked = false,
) {
  return (
    (await window.piDesktop?.startDirectoryDiffStream?.(
      directoryId,
      baseline,
      streamId,
      includeUntracked,
    )) ?? null
  )
}

export function canStartDirectoryDiffStreamQuery() {
  return (
    typeof window !== 'undefined' &&
    typeof window.piDesktop?.startDirectoryDiffStream === 'function'
  )
}

export async function cancelDirectoryDiffStreamQuery(streamId: string): Promise<void> {
  await window.piDesktop?.cancelDirectoryDiffStream?.(streamId)
}

export async function getDirectoryDiffStatsQuery(
  directoryId: string,
  baseline: DirectoryDiffBaseline | null = null,
  includeUntracked = false,
): Promise<DirectoryDiffStatsResult | null> {
  return (
    (await window.piDesktop?.getDirectoryDiffStats?.(directoryId, baseline, includeUntracked)) ??
    null
  )
}

export async function getDirectoryDiffImagePreviewQuery(request: {
  directoryId: string
  baseline?: DirectoryDiffBaseline | null | undefined
  path: string
  side: DirectoryDiffImageSide
}): Promise<DirectoryDiffImagePreview> {
  return (await window.piDesktop?.getDirectoryDiffImagePreview?.(request)) ?? null
}

export async function getDirectoryDiffFileContentsQuery(
  request: DirectoryDiffFileContentsRequest,
): Promise<DirectoryDiffFileContentsResult | null> {
  return (await window.piDesktop?.getDirectoryDiffFileContents?.(request)) ?? null
}

export async function listDirectoryCommitsQuery(
  directoryId: string,
  limit = 50,
): Promise<DirectoryCommitEntry[]> {
  return (await window.piDesktop?.listDirectoryCommits?.(directoryId, limit)) ?? []
}
