import type { DesktopChatEndContribution } from '@howcode/app-shell'
import { useMemo } from 'react'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'

export function useDirectoryDesktopEventContribution({
  enabled,
  loadDirectoryChats,
  queryClient,
}: {
  enabled: boolean
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  queryClient: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
  }
}): DesktopChatEndContribution {
  return useMemo(
    () => ({
      refreshChatList(event) {
        if (enabled) void loadDirectoryChats(event.directoryId)
      },
      refreshDirectoryState(event) {
        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.directoryUsageSummary(event.directoryId),
        })
      },
    }),
    [enabled, loadDirectoryChats, queryClient],
  )
}
