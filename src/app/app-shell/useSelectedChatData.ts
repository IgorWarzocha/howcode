import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ChatCustomMessageRecord, ChatData } from '../desktop/types'
import { useDesktopChatQuery } from '../hooks/useDesktopChat'

function mergeCustomMessages(
  liveMessages: ChatCustomMessageRecord[] | undefined,
  snapshotMessages: ChatCustomMessageRecord[] | undefined,
) {
  if ((snapshotMessages?.length ?? 0) === 0) return liveMessages
  if ((liveMessages?.length ?? 0) === 0) return snapshotMessages
  if (!(liveMessages && snapshotMessages)) return liveMessages ?? snapshotMessages
  const byId = new Map(liveMessages.map((message) => [message.id, message]))
  for (const message of snapshotMessages) byId.set(message.id, message)
  return [...byId.values()]
}

function mergeChatHistorySideChannels(liveChat: ChatData, snapshotChat: ChatData | null) {
  if (!snapshotChat || liveChat.conversationId !== snapshotChat.conversationId) return liveChat
  const customMessages = mergeCustomMessages(liveChat.customMessages, snapshotChat.customMessages)
  return customMessages === liveChat.customMessages ? liveChat : { ...liveChat, customMessages }
}

export function useSelectedChatData(input: {
  liveChatData: ChatData | null
  selectedConversationId: string | null
  chatHistoryCompactions: number
  chatQueryDeferred: boolean
  chatRefreshKey: number
}) {
  const chatQuery = useDesktopChatQuery(
    input.selectedConversationId,
    input.chatRefreshKey,
    input.chatHistoryCompactions,
    { enabled: !input.chatQueryDeferred },
  )
  const chatData = chatQuery.data ?? null
  const selectedPersistedConversationId = getPersistedConversationId(input.selectedConversationId)
  const chatDataMatchesSelection = chatData?.conversationId === selectedPersistedConversationId
  const liveDataMatchesSelection =
    input.liveChatData?.conversationId === selectedPersistedConversationId
  const activeChatLoading = Boolean(
    selectedPersistedConversationId &&
      (chatQuery.isLoading || chatQuery.isFetching) &&
      !(liveDataMatchesSelection || chatDataMatchesSelection),
  )

  const baseEffectiveChatData =
    input.chatHistoryCompactions === 0 &&
    input.liveChatData?.conversationId === input.selectedConversationId
      ? mergeChatHistorySideChannels(input.liveChatData, chatDataMatchesSelection ? chatData : null)
      : chatDataMatchesSelection
        ? chatData
        : null

  const effectiveChatData = baseEffectiveChatData

  return { activeChatLoading, effectiveChatData }
}
