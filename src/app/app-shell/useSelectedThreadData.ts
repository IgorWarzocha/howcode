import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ThreadCustomMessageRecord, ThreadData } from '../desktop/types'
import { useDesktopThreadQuery } from '../hooks/useDesktopThread'

function mergeCustomMessages(
  liveMessages: ThreadCustomMessageRecord[] | undefined,
  snapshotMessages: ThreadCustomMessageRecord[] | undefined,
) {
  if ((snapshotMessages?.length ?? 0) === 0) return liveMessages
  if ((liveMessages?.length ?? 0) === 0) return snapshotMessages
  if (!(liveMessages && snapshotMessages)) return liveMessages ?? snapshotMessages
  const byId = new Map(liveMessages.map((message) => [message.id, message]))
  for (const message of snapshotMessages) byId.set(message.id, message)
  return [...byId.values()]
}

function mergeThreadHistorySideChannels(liveThread: ThreadData, snapshotThread: ThreadData | null) {
  if (!snapshotThread || liveThread.conversationId !== snapshotThread.conversationId)
    return liveThread
  const customMessages = mergeCustomMessages(
    liveThread.customMessages,
    snapshotThread.customMessages,
  )
  return customMessages === liveThread.customMessages
    ? liveThread
    : { ...liveThread, customMessages }
}

export function useSelectedThreadData(input: {
  liveThreadData: ThreadData | null
  selectedConversationId: string | null
  threadHistoryCompactions: number
  threadQueryDeferred: boolean
  threadRefreshKey: number
}) {
  const threadQuery = useDesktopThreadQuery(
    input.selectedConversationId,
    input.threadRefreshKey,
    input.threadHistoryCompactions,
    { enabled: !input.threadQueryDeferred },
  )
  const threadData = threadQuery.data ?? null
  const selectedPersistedConversationId = getPersistedConversationId(input.selectedConversationId)
  const threadDataMatchesSelection = threadData?.conversationId === selectedPersistedConversationId
  const liveDataMatchesSelection =
    input.liveThreadData?.conversationId === selectedPersistedConversationId
  const activeThreadLoading = Boolean(
    selectedPersistedConversationId &&
      (threadQuery.isLoading || threadQuery.isFetching) &&
      !(liveDataMatchesSelection || threadDataMatchesSelection),
  )

  const baseEffectiveThreadData =
    input.threadHistoryCompactions === 0 &&
    input.liveThreadData?.conversationId === input.selectedConversationId
      ? mergeThreadHistorySideChannels(
          input.liveThreadData,
          threadDataMatchesSelection ? threadData : null,
        )
      : threadDataMatchesSelection
        ? threadData
        : null

  const effectiveThreadData = baseEffectiveThreadData

  return { activeThreadLoading, effectiveThreadData }
}
