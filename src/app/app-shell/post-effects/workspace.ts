import type { QueryClient } from '@tanstack/react-query'
import type { ProjectGitState } from '../../desktop/types'
import { notifyProjectDiffInvalidated } from '../../hooks/project-diff-invalidation'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { ActionPayload } from '../controller-action-utils'
import { getPayloadProjectId } from '../controller-action-utils'

export async function applyWorkspaceCommitPostEffect(input: {
  contextualPayload: ActionPayload
  committed: boolean
  queryClient: QueryClient
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (!(projectId && input.committed)) return

  notifyProjectDiffInvalidated(projectId)
  await Promise.all([
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
    }),
  ])
  input.setProjectGitState(await input.loadProjectGitState(projectId))
}

export async function applyCommitOptionsPostEffect(input: {
  contextualPayload: ActionPayload
  refreshShellState: () => Promise<unknown>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (projectId) input.setProjectGitState(await input.loadProjectGitState(projectId))
  await input.refreshShellState()
}

export async function applySwitchBranchPostEffect(input: {
  contextualPayload: ActionPayload
  queryClient: QueryClient
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (!projectId) return

  notifyProjectDiffInvalidated(projectId)
  await Promise.all([
    input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectGitState(projectId) }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
    }),
  ])
  input.setProjectGitState(await input.loadProjectGitState(projectId))
}
