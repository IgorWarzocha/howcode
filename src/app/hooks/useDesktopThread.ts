import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import { useQuery } from '@tanstack/react-query'
import type { ThreadData } from '../desktop/types'
import { desktopQueryKeys, getThreadQuery } from '../query/desktop-query'

export function useDesktopThreadQuery(
  conversationId: string | null | undefined,
  refreshKey = 0,
  historyCompactions = 0,
  options: { enabled?: boolean | undefined } = {},
) {
  const persistedConversationId = getPersistedConversationId(conversationId)

  return useQuery<ThreadData | null>({
    queryKey: persistedConversationId
      ? desktopQueryKeys.thread(persistedConversationId, refreshKey, historyCompactions)
      : ['desktop', 'thread', null, refreshKey, historyCompactions],
    queryFn: () =>
      persistedConversationId
        ? getThreadQuery(persistedConversationId, historyCompactions)
        : Promise.resolve(null),
    placeholderData: (previousData) => previousData,
    enabled: Boolean(persistedConversationId) && options.enabled !== false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
