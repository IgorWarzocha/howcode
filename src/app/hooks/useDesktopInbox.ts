import { useQuery } from '@tanstack/react-query'
import type { InboxChat } from '../desktop/types'
import { desktopQueryKeys, getInboxChatsQuery } from '../query/desktop-query'

export function useDesktopInbox() {
  return useQuery<InboxChat[]>({
    queryKey: desktopQueryKeys.inboxChats(),
    queryFn: getInboxChatsQuery,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
