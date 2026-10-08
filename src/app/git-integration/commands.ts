import { notifyDirectoryDiffInvalidated } from '@howaboua/howcode-git/ui/hooks/directory-diff-invalidation'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import { desktopQueryKeys } from '../query/desktop-query-keys'
import type { WorkspaceAction } from '../state/workspace-model'

function resetDirectoryDiffCaches(queryClient: QueryClient, directoryId: string) {
  notifyDirectoryDiffInvalidated(directoryId)
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.directoryDiffStatsPrefix(directoryId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.directoryDiffImagePreviewPrefix(directoryId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.directoryCommitsPrefix(directoryId),
  })
}

export function useGitWorkspaceCommands({
  composerDirectoryId,
  dispatch,
  queryClient,
}: {
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  queryClient: QueryClient
}) {
  const handleOpenGitOpsView = (options: { filePath?: string | null } = {}) => {
    if (composerDirectoryId) {
      resetDirectoryDiffCaches(queryClient, composerDirectoryId)
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
