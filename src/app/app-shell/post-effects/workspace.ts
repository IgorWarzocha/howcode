import type { QueryClient } from '@tanstack/react-query'
import type { DesktopActionResult, ProjectGitState } from '../../desktop/types'
import { notifyProjectDiffInvalidated } from '../../hooks/project-diff-invalidation'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { ActionPayload } from '../controller-action-utils'
import { getPayloadProjectId } from '../controller-action-utils'
import {
  removeShellWorktreeProject,
  setShellWorktreeCompleted,
  setShellWorktreeDirectory,
  upsertShellWorktreeProject,
} from '../project-shell-cache'

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
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (!projectId) return

  notifyProjectDiffInvalidated(projectId)
  await Promise.all([
    input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectGitState(projectId) }),
    input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectThreads(projectId) }),
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
  await input.loadProjectThreads(projectId, { chat: false })
  input.setProjectGitState(await input.loadProjectGitState(projectId))
}

export async function applyCreateWorktreePostEffect(input: {
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const rootProjectId =
    input.actionResult?.result?.rootProjectId ?? getPayloadProjectId(input.contextualPayload)
  const worktreeProjectId = input.actionResult?.result?.projectId
  const branchName = input.actionResult?.result?.branchName ?? null
  if (rootProjectId && worktreeProjectId) {
    upsertShellWorktreeProject(input.queryClient, {
      rootProjectId,
      worktreeProjectId,
      branchName,
      parentBranchName:
        typeof input.contextualPayload.parentBranchName === 'string'
          ? input.contextualPayload.parentBranchName
          : null,
    })
  }
  const projectIds = [...new Set([rootProjectId, worktreeProjectId].filter(Boolean))] as string[]
  if (projectIds.length === 0) return

  await Promise.all(
    projectIds.map((projectId) =>
      input.queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.projectGitState(projectId),
      }),
    ),
  )
  if (rootProjectId) input.setProjectGitState(await input.loadProjectGitState(rootProjectId))
}

export async function applyWorktreeMetadataPostEffect(input: {
  action: string
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const rootProjectId =
    input.actionResult?.result?.rootProjectId ?? getPayloadProjectId(input.contextualPayload)
  const worktreeProjectId =
    input.actionResult?.result?.projectId ??
    (typeof input.contextualPayload.worktreePath === 'string'
      ? input.contextualPayload.worktreePath
      : null)
  if (!rootProjectId) return

  if (
    input.contextualPayload.worktreeDirectory &&
    typeof input.contextualPayload.worktreeDirectory === 'string'
  ) {
    setShellWorktreeDirectory(
      input.queryClient,
      rootProjectId,
      input.contextualPayload.worktreeDirectory,
    )
  }
  if (worktreeProjectId) {
    if (input.action === 'workspace.mark-worktree-complete') {
      setShellWorktreeCompleted(input.queryClient, worktreeProjectId, true)
    }
    if (input.action === 'workspace.mark-worktree-incomplete') {
      setShellWorktreeCompleted(input.queryClient, worktreeProjectId, false)
    }
  }

  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectGitState(rootProjectId),
  })
  input.setProjectGitState(await input.loadProjectGitState(rootProjectId))
}

export async function applyRemoveWorktreePostEffect(input: {
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: (state: ProjectGitState | null) => void
}) {
  const rootProjectId =
    input.actionResult?.result?.rootProjectId ?? getPayloadProjectId(input.contextualPayload)
  const worktreeProjectId =
    input.actionResult?.result?.projectId ??
    (typeof input.contextualPayload.worktreePath === 'string'
      ? input.contextualPayload.worktreePath
      : null)
  const bulkWorktrees = Array.isArray(input.contextualPayload.worktrees)
    ? input.contextualPayload.worktrees
        .map((worktree) => worktree.worktreePath)
        .filter((worktreePath): worktreePath is string => typeof worktreePath === 'string')
    : []
  const removedWorktreeIds = [
    ...new Set([worktreeProjectId, ...bulkWorktrees].filter(Boolean)),
  ] as string[]
  if (!rootProjectId) return
  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectGitState(rootProjectId),
  })
  const nextProjectGitState = await input.loadProjectGitState(rootProjectId)
  input.setProjectGitState(nextProjectGitState)
  for (const removedWorktreeId of removedWorktreeIds) {
    removeShellWorktreeProject(input.queryClient, removedWorktreeId)
  }
}
