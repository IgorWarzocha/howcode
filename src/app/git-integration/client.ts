import type { GitService } from '@howaboua/howcode-git/service/contracts'
import { isGitRendererApi } from '../component-system/git-renderer-api'
import { getInstalledRendererContributions } from '../component-system/installed-component-catalog'
import type {
  DirectoryCommitEntry,
  DirectoryDiffBaseline,
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
  DirectoryDiffImagePreview,
  DirectoryDiffImageSide,
  DirectoryDiffStatsResult,
} from '../desktop/types'

export type GitBridge = {
  getDirectoryGitState?: GitService['loadDirectoryGitState'] | undefined
  startDirectoryDiffStream?: GitService['startDirectoryDiffStream'] | undefined
  cancelDirectoryDiffStream?: GitService['cancelDirectoryDiffStream'] | undefined
  getDirectoryDiffStats?: GitService['loadDirectoryDiffStats'] | undefined
  getDirectoryDiffImagePreview?: GitService['loadDirectoryDiffImagePreview'] | undefined
  getDirectoryDiffFileContents?: GitService['loadDirectoryDiffFileContents'] | undefined
  listDirectoryCommits?: GitService['listDirectoryCommits'] | undefined
}

function getBridge(): GitBridge | undefined {
  return getGitRendererApi() ? window.piDesktop : undefined
}

export async function startDirectoryDiffStreamQuery(
  directoryId: string,
  baseline: DirectoryDiffBaseline | null = null,
  streamId: string | null = null,
  includeUntracked = false,
) {
  return (
    (await getBridge()?.startDirectoryDiffStream?.(
      directoryId,
      baseline,
      streamId,
      includeUntracked,
    )) ?? null
  )
}

export function canStartDirectoryDiffStreamQuery() {
  return typeof getBridge()?.startDirectoryDiffStream === 'function'
}

export async function cancelDirectoryDiffStreamQuery(streamId: string): Promise<void> {
  await getBridge()?.cancelDirectoryDiffStream?.(streamId)
}

export async function getDirectoryDiffStatsQuery(
  directoryId: string,
  baseline: DirectoryDiffBaseline | null = null,
  includeUntracked = false,
): Promise<DirectoryDiffStatsResult | null> {
  return (
    (await getBridge()?.getDirectoryDiffStats?.(directoryId, baseline, includeUntracked)) ?? null
  )
}

export async function getDirectoryDiffImagePreviewQuery(request: {
  directoryId: string
  baseline?: DirectoryDiffBaseline | null | undefined
  path: string
  side: DirectoryDiffImageSide
}): Promise<DirectoryDiffImagePreview> {
  return (await getBridge()?.getDirectoryDiffImagePreview?.(request)) ?? null
}

export async function getDirectoryDiffFileContentsQuery(
  request: DirectoryDiffFileContentsRequest,
): Promise<DirectoryDiffFileContentsResult | null> {
  return (await getBridge()?.getDirectoryDiffFileContents?.(request)) ?? null
}

export async function listDirectoryCommitsQuery(
  directoryId: string,
  limit = 50,
): Promise<DirectoryCommitEntry[]> {
  return (await getBridge()?.listDirectoryCommits?.(directoryId, limit)) ?? []
}

export function getGitRendererApi() {
  const api = getInstalledRendererContributions()['@howaboua/howcode-git']?.git
  return isGitRendererApi(api) ? api : undefined
}
export function notifyDirectoryDiffInvalidated(directoryId: string) {
  getGitRendererApi()?.notifyDirectoryDiffInvalidated(directoryId)
}
