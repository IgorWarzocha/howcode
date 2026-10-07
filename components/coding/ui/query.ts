import type { DesktopRequestMap } from '@howcode/shared/desktop-ipc'
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffFileContentsRequest,
  ProjectDiffFileContentsResult,
  ProjectDiffImagePreview,
  ProjectDiffImageSide,
  ProjectDiffStatsResult,
  ProjectGitState,
  ProjectUsageSummary,
} from '../../../src/app/desktop/types'
export async function getProjectGitStateQuery(projectId: string): Promise<ProjectGitState | null> {
  return (await window.piDesktop?.getProjectGitState?.(projectId)) ?? null
}

export async function getProjectUsageSummaryQuery(
  projectId: string,
): Promise<ProjectUsageSummary | null> {
  return (await window.piDesktop?.getProjectUsageSummary?.(projectId)) ?? null
}

export async function getProjectFaviconQuery(projectId: string): Promise<string | null> {
  return (await window.piDesktop?.getProjectFavicon?.(projectId)) ?? null
}

export async function startProjectDiffStreamQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
  streamId: string | null = null,
  includeUntracked = false,
) {
  return (
    (await window.piDesktop?.startProjectDiffStream?.(
      projectId,
      baseline,
      streamId,
      includeUntracked,
    )) ?? null
  )
}

export function canStartProjectDiffStreamQuery() {
  return (
    typeof window !== 'undefined' && typeof window.piDesktop?.startProjectDiffStream === 'function'
  )
}

export async function cancelProjectDiffStreamQuery(streamId: string): Promise<void> {
  await window.piDesktop?.cancelProjectDiffStream?.(streamId)
}

export async function getProjectDiffStatsQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
  includeUntracked = false,
): Promise<ProjectDiffStatsResult | null> {
  return (
    (await window.piDesktop?.getProjectDiffStats?.(projectId, baseline, includeUntracked)) ?? null
  )
}

export async function getProjectDiffImagePreviewQuery(request: {
  projectId: string
  baseline?: ProjectDiffBaseline | null | undefined
  path: string
  side: ProjectDiffImageSide
}): Promise<ProjectDiffImagePreview> {
  return (await window.piDesktop?.getProjectDiffImagePreview?.(request)) ?? null
}

export async function getProjectDiffFileContentsQuery(
  request: ProjectDiffFileContentsRequest,
): Promise<ProjectDiffFileContentsResult | null> {
  return (await window.piDesktop?.getProjectDiffFileContents?.(request)) ?? null
}

export async function listProjectCommitsQuery(
  projectId: string,
  limit = 50,
): Promise<ProjectCommitEntry[]> {
  return (await window.piDesktop?.listProjectCommits?.(projectId, limit)) ?? []
}

export async function listProjectDirectoryEntriesQuery(
  request: DesktopRequestMap['listProjectDirectoryEntries']['params'] = {},
): Promise<DesktopRequestMap['listProjectDirectoryEntries']['response'] | null> {
  return (await window.piDesktop?.listProjectDirectoryEntries?.(request)) ?? null
}
