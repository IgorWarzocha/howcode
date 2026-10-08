import type { ChatData, InboxChat } from './desktop-contracts'

export function getEffectiveChatRunningState(
  persistedRunning: boolean | number,
  liveChat: Pick<ChatData, 'isStreaming' | 'isCompacting'> | null,
) {
  if (liveChat) {
    return liveChat.isStreaming || liveChat.isCompacting
  }

  return Boolean(persistedRunning)
}

export function sortInboxChatsByPriority(chats: InboxChat[]) {
  return chats.toSorted((left, right) => {
    if (left.unread !== right.unread) {
      return left.unread ? -1 : 1
    }

    if (left.running !== right.running) {
      return left.running ? -1 : 1
    }

    const leftActivity = left.lastActivityMs ?? 0
    const rightActivity = right.lastActivityMs ?? 0
    if (leftActivity !== rightActivity) {
      return rightActivity - leftActivity
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
  })
}
