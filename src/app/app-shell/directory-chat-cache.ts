import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { Chat, ShellState } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import { mergeChatCacheFields } from './chat-cache-merge'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: (current: unknown) => unknown) => void
}

type ApplyDirectoryChatOptions = {
  replaceConversationId?: string | null
  revealDirectory?: boolean
}

function sameChat(left: Chat, right: Chat, replaceConversationId: string | null) {
  if (left.id === right.id) {
    return true
  }

  if (left.conversationId && right.conversationId && left.conversationId === right.conversationId) {
    return true
  }

  return Boolean(replaceConversationId && left.conversationId === replaceConversationId)
}

export function applyDirectoryChatToShellState(
  queryClient: QueryClientLike,
  directoryId: string,
  chat: Chat,
  options: ApplyDirectoryChatOptions = {},
) {
  const replaceConversationId = options.replaceConversationId ?? null
  const revealDirectory = options.revealDirectory ?? false

  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) {
      return currentState ?? null
    }

    return {
      ...currentState,
      directories: currentState.directories.map((directory) => {
        if (directory.id !== directoryId) {
          return directory
        }

        const existingChat = directory.chats.find((candidate) =>
          sameChat(candidate, chat, replaceConversationId),
        )
        const nextChat = mergeChatCacheFields(existingChat, chat)
        const remainingChats = directory.chats.filter(
          (candidate) => !sameChat(candidate, chat, replaceConversationId),
        )
        const chats = [nextChat, ...remainingChats]

        return {
          ...directory,
          chats,
          chatCount: Math.max(directory.chatCount ?? 0, chats.length),
          chatsLoaded: true,
          latestModifiedMs: Math.max(directory.latestModifiedMs ?? 0, chat.lastModifiedMs ?? 0),
          collapsed: revealDirectory ? false : directory.collapsed,
        }
      }),
    }
  })
}

export function getDraftReplacementConversationId(
  selectedConversationId: string | null,
  selectedDirectoryId: string,
  eventDirectoryId: string,
) {
  return selectedDirectoryId === eventDirectoryId && isLocalConversationId(selectedConversationId)
    ? selectedConversationId
    : null
}

export function removeDirectoryChatFromShellState(
  queryClient: QueryClientLike,
  directoryId: string,
  conversationId: string,
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) {
      return currentState ?? null
    }

    return {
      ...currentState,
      directories: currentState.directories.map((directory) => {
        if (directory.id !== directoryId) {
          return directory
        }

        const chats = directory.chats.filter((chat) => chat.conversationId !== conversationId)
        const removedChatCount = directory.chats.length - chats.length
        const indexedChatCount = directory.chatCount ?? directory.chats.length
        const nextChatCount =
          indexedChatCount > directory.chats.length
            ? indexedChatCount
            : Math.max(chats.length, indexedChatCount - removedChatCount)

        return {
          ...directory,
          chats,
          chatCount: nextChatCount,
        }
      }),
    }
  })
}
