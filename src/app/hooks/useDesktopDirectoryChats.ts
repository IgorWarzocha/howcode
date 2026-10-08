import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Chat, ShellState } from '../desktop/types'
import { desktopQueryKeys, getDirectoryChatsQuery } from '../query/desktop-query'

const localDraftCacheByDirectory = new Map<string, Chat[]>()

function hasSameChat(chats: Chat[], candidate: Chat) {
  return chats.some(
    (chat) =>
      chat.id === candidate.id ||
      Boolean(chat.conversationId && chat.conversationId === candidate.conversationId),
  )
}

export function preserveLocalDraftChats(
  fetchedChats: Chat[],
  currentChats: Chat[],
  cachedChats: Chat[] = [],
  replaceLocalDraftConversationId: string | null = null,
) {
  const localDrafts = [...cachedChats, ...currentChats].filter((chat) =>
    isLocalConversationId(chat.conversationId),
  )
  const uniqueDrafts = localDrafts.filter(
    (draft, index) => !hasSameChat(localDrafts.slice(0, index), draft),
  )
  return [
    ...uniqueDrafts.filter((draft) => {
      if (hasSameChat(fetchedChats, draft)) return false
      if (
        replaceLocalDraftConversationId === null ||
        draft.conversationId !== replaceLocalDraftConversationId
      )
        return true
      const draftStartedAt = draft.lastModifiedMs ?? Number.POSITIVE_INFINITY
      return !fetchedChats.some(
        (chat) =>
          chat.conversationId &&
          !isLocalConversationId(chat.conversationId) &&
          (chat.lastModifiedMs ?? 0) >= draftStartedAt - 1000,
      )
    }),
    ...fetchedChats,
  ]
}

function cacheLocalDrafts(directoryId: string, chats: Chat[]) {
  const drafts = chats.filter((chat) => isLocalConversationId(chat.conversationId))
  if (drafts.length === 0) localDraftCacheByDirectory.delete(directoryId)
  else localDraftCacheByDirectory.set(directoryId, drafts)
}

export function forgetLocalDraftChat(
  directoryId: string,
  conversationId: string | null | undefined,
) {
  if (!conversationId) return
  cacheLocalDrafts(
    directoryId,
    (localDraftCacheByDirectory.get(directoryId) ?? []).filter(
      (chat) => chat.conversationId !== conversationId,
    ),
  )
}

export function useDesktopDirectoryChats() {
  const queryClient = useQueryClient()
  return useCallback(
    async (
      directoryId: string,
      options: { replaceLocalDraftConversationId?: string | null | undefined } = {},
    ) => {
      const chats = await queryClient.fetchQuery({
        queryKey: desktopQueryKeys.directoryChats(directoryId),
        queryFn: () => getDirectoryChatsQuery(directoryId),
        staleTime: 0,
      })
      queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (current) =>
        current
          ? {
              ...current,
              directories: current.directories.map((directory) => {
                if (directory.id !== directoryId) return directory
                const merged = preserveLocalDraftChats(
                  chats,
                  directory.chats,
                  localDraftCacheByDirectory.get(directoryId),
                  options.replaceLocalDraftConversationId ?? null,
                )
                cacheLocalDrafts(directoryId, merged)
                return { ...directory, chats: merged, chatCount: merged.length, chatsLoaded: true }
              }),
            }
          : (current ?? null),
      )
      return chats
    },
    [queryClient],
  )
}
