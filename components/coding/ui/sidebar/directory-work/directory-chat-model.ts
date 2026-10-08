import type { Chat, WorkingDirectory } from '../../../../../src/app/types'

const OLD_CHAT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export type ChatBuckets = {
  activeChats: Chat[]
  olderChats: Chat[]
}

export type SidebarChat = Chat & {
  sidebarWorktreePath?: string | undefined
  sidebarWorktreeLabel?: string | undefined
}

function getChatSortValue(chat: Chat) {
  return chat.lastModifiedMs ?? 0
}

export function sortChats(chats: Chat[]) {
  return chats.toSorted((a, b) => getChatSortValue(b) - getChatSortValue(a))
}

export function bucketChats(
  directory: WorkingDirectory,
  selectedChatId: string | null,
): ChatBuckets {
  const sortedChats = sortChats(directory.chats)
  const cutoffMs = Date.now() - OLD_CHAT_THRESHOLD_MS
  const activeChats: Chat[] = []
  const olderChats: Chat[] = []

  for (const chat of sortedChats) {
    const shouldKeepVisible =
      chat.id === selectedChatId ||
      Boolean(chat.pinned) ||
      Boolean(chat.running) ||
      Boolean(chat.unread) ||
      (chat.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) >= cutoffMs

    if (shouldKeepVisible) {
      activeChats.push(chat)
    } else {
      olderChats.push(chat)
    }
  }

  return { activeChats, olderChats }
}

export function getWorktreeDirectoriesForRoot(
  directory: WorkingDirectory,
  directories: readonly WorkingDirectory[],
) {
  return directories.filter(
    (candidate) =>
      candidate.id !== directory.id &&
      candidate.worktree?.rootDirectoryId === directory.id &&
      candidate.worktree.isMain === false,
  )
}

export function getChatBucketsForDirectoryWork(
  directory: WorkingDirectory,
  directories: readonly WorkingDirectory[],
  selectedChatId: string | null,
) {
  const rootBuckets = bucketChats(directory, selectedChatId)
  const worktreeBuckets = getWorktreeDirectoriesForRoot(directory, directories).reduce(
    (buckets, worktreeDirectory) => {
      const nextBuckets = bucketChats(worktreeDirectory, selectedChatId)
      const annotateChat = (chat: Chat): SidebarChat => ({
        ...chat,
        sidebarWorktreePath: worktreeDirectory.id,
        sidebarWorktreeLabel: worktreeDirectory.worktree?.branchName ?? worktreeDirectory.name,
        branchName: worktreeDirectory.worktree?.branchName ?? chat.branchName ?? undefined,
      })
      buckets.activeChats.push(...nextBuckets.activeChats.map(annotateChat))
      buckets.olderChats.push(...nextBuckets.olderChats.map(annotateChat))
      return buckets
    },
    { activeChats: [...rootBuckets.activeChats], olderChats: [...rootBuckets.olderChats] },
  )
  return {
    activeChats: sortChats(worktreeBuckets.activeChats),
    olderChats: sortChats(worktreeBuckets.olderChats),
  }
}

export function filterChatsForCurrentBranch(chats: readonly Chat[], currentBranch: string | null) {
  if (!currentBranch) return []
  return sortChats(chats.filter((chat) => chat.branchName === currentBranch))
}

export function filterChatsBySearch(chats: readonly Chat[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return [...chats]
  return chats.filter((chat) =>
    [chat.title, chat.summary ?? '', chat.branchName ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchQuery),
  )
}
