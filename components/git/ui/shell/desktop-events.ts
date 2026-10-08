import type { DesktopChatEndContribution } from '@howcode/app-shell'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import type { DirectoryGitState } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import { notifyDirectoryDiffInvalidated } from '../hooks/directory-diff-invalidation'

type QueryClientLike = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export function invalidateDirectoryWorktreeQueries({
  directoryId,
  queryClient,
}: {
  directoryId: string
  queryClient: QueryClientLike
}) {
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

export function useGitDesktopEventContribution({
  enabled,
  composerDirectoryId,
  loadDirectoryGitState,
  setDirectoryGitState,
  queryClient,
}: {
  enabled: boolean
  composerDirectoryId: string
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  queryClient: QueryClientLike
}): Pick<DesktopChatEndContribution, 'refreshDirectoryState'> {
  return useMemo(
    () => ({
      refreshDirectoryState(event) {
        // Cache invalidation also ran with coding disabled before this policy moved here.
        invalidateDirectoryWorktreeQueries({
          directoryId: event.directoryId,
          queryClient,
        })
        if (enabled && event.directoryId === composerDirectoryId) {
          void loadDirectoryGitState(event.directoryId).then(setDirectoryGitState)
        }
      },
    }),
    [enabled, composerDirectoryId, loadDirectoryGitState, setDirectoryGitState, queryClient],
  )
}
