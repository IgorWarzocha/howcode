import type { ChatSidebarState, ChatThread } from '../desktop/types'
import { mergeThreadCacheFields } from './thread-cache-merge'

type ApplyChatThreadOptions = {
  replaceSessionPath?: string | null
}

function sameChatThread(left: ChatThread, right: ChatThread, replaceSessionPath: string | null) {
  if (left.id === right.id) return true
  if (left.sessionPath && right.sessionPath && left.sessionPath === right.sessionPath) return true
  return Boolean(replaceSessionPath && left.sessionPath === replaceSessionPath)
}

export function applyChatThreadToSidebarState(
  currentState: ChatSidebarState | null,
  thread: ChatThread,
  options: ApplyChatThreadOptions = {},
): ChatSidebarState | null {
  if (!currentState) return currentState

  const replaceSessionPath = options.replaceSessionPath ?? null
  const targetGroupId = thread.groupId ?? null
  const applyToThreads = (threads: ChatThread[], shouldInsert: boolean) => {
    const existingThread = threads.find((candidate) =>
      sameChatThread(candidate, thread, replaceSessionPath),
    )
    const remainingThreads = threads.filter(
      (candidate) => !sameChatThread(candidate, thread, replaceSessionPath),
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
  sessionPath: string,
): ChatSidebarState | null {
  if (!currentState) return currentState

  return {
    ...currentState,
    ungroupedThreads: currentState.ungroupedThreads.filter(
      (thread) => thread.sessionPath !== sessionPath,
    ),
    groups: currentState.groups.map((group) => ({
      ...group,
      threads: group.threads.filter((thread) => thread.sessionPath !== sessionPath),
    })),
  }
}
