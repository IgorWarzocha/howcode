import { useDesktopProjectOrder } from './useDesktopProjectOrder'
import { useDesktopShellQueries } from './useDesktopShellQueries'
import { useDesktopShellStateQuery } from './useDesktopShellStateQuery'

export function useDesktopShell() {
  const { refreshShellState, scheduleShellStateRefresh, shellStateQuery } =
    useDesktopShellStateQuery()
  const shellQueries = useDesktopShellQueries()
  const applyProjectOrder = useDesktopProjectOrder()

  return {
    shellState: shellStateQuery.data ?? null,
    shellLoading: shellStateQuery.isLoading,
    refreshShellState,
    scheduleShellStateRefresh,
    loadProjectThreads: shellQueries.loadProjectThreads,
    applyProjectOrder,
    loadArchivedThreads: shellQueries.loadArchivedThreads,
    loadComposerState: shellQueries.loadComposerState,
    listComposerAttachmentEntries: shellQueries.listComposerAttachmentEntries,
    loadProjectGitState: shellQueries.loadProjectGitState,
    pickComposerAttachments: shellQueries.pickComposerAttachments,
  }
}
