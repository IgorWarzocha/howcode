import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import { useQuery } from '@tanstack/react-query'
import type { ChatData } from '../desktop/types'
import { desktopQueryKeys, getChatQuery } from '../query/desktop-query'

export function useDesktopChatQuery(
  conversationId: string | null | undefined,
  refreshKey = 0,
  historyCompactions = 0,
  options: { enabled?: boolean | undefined } = {},
) {
  const persistedConversationId = getPersistedConversationId(conversationId)

  return useQuery<ChatData | null>({
    queryKey: persistedConversationId
      ? desktopQueryKeys.chat(persistedConversationId, refreshKey, historyCompactions)
      : ['desktop', 'chat', null, refreshKey, historyCompactions],
    queryFn: () =>
      persistedConversationId
        ? getChatQuery(persistedConversationId, historyCompactions)
        : Promise.resolve(null),
    placeholderData: (previousData) => previousData,
    enabled: Boolean(persistedConversationId) && options.enabled !== false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
