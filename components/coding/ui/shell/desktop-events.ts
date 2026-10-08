import type { DesktopChatEndContribution } from '@howcode/app-shell'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import type { DirectoryGitState } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { View } from '../../../../src/app/types'
import { notifyDirectoryDiffInvalidated } from '../hooks/directory-diff-invalidation'

type QueryClientLike = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export function invalidateDirectoryWorktreeQueries({
  activeView,
  directoryId,
  queryClient,
}: {
  activeView: View
  directoryId: string
  queryClient: QueryClientLike
}) {
  if (activeView === 'gitops') notifyDirectoryDiffInvalidated(directoryId)
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

export function useCodingDesktopEventContribution({
  enabled,
  composerDirectoryId,
  loadDirectoryChats,
  loadDirectoryGitState,
  setDirectoryGitState,
  queryClient,
}: {
  enabled: boolean
  composerDirectoryId: string
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  queryClient: QueryClientLike
}): DesktopChatEndContribution {
  return useMemo(
    () => ({
      refreshChatList(event) {
        if (!enabled) return
        void loadDirectoryChats(event.directoryId)
      },
      refreshDirectoryState(event, activeView) {
        // Cache invalidation also ran with coding disabled before this policy moved here.
        invalidateDirectoryWorktreeQueries({
          activeView,
          directoryId: event.directoryId,
          queryClient,
        })
        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.directoryUsageSummary(event.directoryId),
        })
        if (enabled && event.directoryId === composerDirectoryId) {
          void loadDirectoryGitState(event.directoryId).then(setDirectoryGitState)
        }
      },
    }),
    [
      enabled,
      composerDirectoryId,
      loadDirectoryChats,
      loadDirectoryGitState,
      setDirectoryGitState,
      queryClient,
    ],
  )
}
