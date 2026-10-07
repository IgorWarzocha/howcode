import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query-keys'
import type { WorkspaceAction } from '../../../../src/app/state/workspace-model'
import { notifyProjectDiffInvalidated } from '../hooks/project-diff-invalidation'

function resetProjectDiffCaches(queryClient: QueryClient, projectId: string) {
  notifyProjectDiffInvalidated(projectId)
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  })
}

export function useCodingWorkspaceCommands({
  composerProjectId,
  dispatch,
  queryClient,
}: {
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  queryClient: QueryClient
}) {
  const handleOpenGitOpsView = (options: { filePath?: string | null } = {}) => {
    if (composerProjectId) {
      resetProjectDiffCaches(queryClient, composerProjectId)
    }

    dispatch({ type: 'open-gitops', filePath: options.filePath ?? null })
  }

  const handleCloseGitOpsView = () => {
    dispatch({ type: 'close-gitops' })
  }

  const handleOpenWorktreeDiffFile = (filePath: string) => {
    handleOpenGitOpsView({ filePath })
  }

  return { handleOpenGitOpsView, handleCloseGitOpsView, handleOpenWorktreeDiffFile }
}
