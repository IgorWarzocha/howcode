import { useDesktopShellQueries } from './useDesktopShellQueries'
import { useDesktopShellStateQuery } from './useDesktopShellStateQuery'

export function useDesktopShell() {
  const { refreshShellState, scheduleShellStateRefresh, shellStateQuery } =
    useDesktopShellStateQuery()
  const shellQueries = useDesktopShellQueries()

  return {
    shellState: shellStateQuery.data ?? null,
    shellLoading: shellStateQuery.isLoading,
    refreshShellState,
    scheduleShellStateRefresh,
    loadDirectoryChats: shellQueries.loadDirectoryChats,
    loadArchivedChats: shellQueries.loadArchivedChats,
    loadComposerState: shellQueries.loadComposerState,
    listComposerAttachmentEntries: shellQueries.listComposerAttachmentEntries,
    loadDirectoryGitState: shellQueries.loadDirectoryGitState,
  }
}
