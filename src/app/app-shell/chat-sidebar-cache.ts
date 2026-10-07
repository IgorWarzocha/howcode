import type { ChatSidebarState, ChatThread } from '../desktop/types'
import { mergeThreadCacheFields } from './thread-cache-merge'

type ApplyChatThreadOptions = {
  replaceConversationId?: string | null
}

function sameChatThread(left: ChatThread, right: ChatThread, replaceConversationId: string | null) {
  if (left.id === right.id) return true
  if (left.conversationId && right.conversationId && left.conversationId === right.conversationId)
    return true
  return Boolean(replaceConversationId && left.conversationId === replaceConversationId)
}

export function applyChatThreadToSidebarState(
  currentState: ChatSidebarState | null,
  thread: ChatThread,
  options: ApplyChatThreadOptions = {},
): ChatSidebarState | null {
  if (!currentState) return currentState

  const replaceConversationId = options.replaceConversationId ?? null
  const targetGroupId = thread.groupId ?? null
  const applyToThreads = (threads: ChatThread[], shouldInsert: boolean) => {
    const existingThread = threads.find((candidate) =>
      sameChatThread(candidate, thread, replaceConversationId),
    )
    const remainingThreads = threads.filter(
      (candidate) => !sameChatThread(candidate, thread, replaceConversationId),
    )

    if (!shouldInsert) return remainingThreads

    return [mergeThreadCacheFields(existingThread, thread), ...remainingThreads]
  }

  return {
    ...currentState,
    ungroupedThreads: applyToThreads(currentState.ungroupedThreads, targetGroupId === null),
    groups: currentState.groups.map((group) => ({
      ...group,
      threads: applyToThreads(group.threads, group.id === targetGroupId),
    })),
  }
}

export function removeChatThreadFromSidebarState(
  currentState: ChatSidebarState | null,
  conversationId: string,
): ChatSidebarState | null {
  if (!currentState) return currentState

  return {
    ...currentState,
    ungroupedThreads: currentState.ungroupedThreads.filter(
      (thread) => thread.conversationId !== conversationId,
    ),
    groups: currentState.groups.map((group) => ({
      ...group,
      threads: group.threads.filter((thread) => thread.conversationId !== conversationId),
    })),
  }
}
