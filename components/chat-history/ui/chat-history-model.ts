import type { Chat, WorkingDirectory } from '../../../src/app/types'

const OLD_CHAT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export type PastChat = Chat & {
  directoryId: string
  worktreeLabel?: string | undefined
}

export type ChatHistoryBulkAction = 'delete' | 'assign-current' | 'unassign'

function getWorktreeDirectories(
  directory: WorkingDirectory,
  directories: readonly WorkingDirectory[],
) {
  return directories.filter(
    (candidate) =>
      candidate.worktree?.isMain === false && candidate.worktree.rootDirectoryId === directory.id,
  )
}

export function getPastChats(
  directory: WorkingDirectory | null,
  directories: readonly WorkingDirectory[],
  nowMs = Date.now(),
) {
  if (!directory) return []
  const cutoffMs = nowMs - OLD_CHAT_THRESHOLD_MS
  const chats: PastChat[] = [
    ...directory.chats.map((chat) => ({ ...chat, directoryId: directory.id })),
    ...getWorktreeDirectories(directory, directories).flatMap((worktreeDirectory) =>
      worktreeDirectory.chats.map((chat) => ({
        ...chat,
        directoryId: worktreeDirectory.id,
        worktreeLabel: worktreeDirectory.worktree?.branchName ?? worktreeDirectory.name,
        branchName: chat.branchName ?? worktreeDirectory.worktree?.branchName ?? undefined,
      })),
    ),
  ]

  return chats
    .filter((chat) => {
      if (chat.pinned || chat.running || chat.unread) return false
      return (chat.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) < cutoffMs
    })
    .sort((left, right) => (right.lastModifiedMs ?? 0) - (left.lastModifiedMs ?? 0))
}

export function filterPastChats(chats: readonly PastChat[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return chats
  return chats.filter((chat) =>
    [chat.title, chat.summary ?? '', chat.branchName ?? '', chat.worktreeLabel ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  )
}

export function getChatAssignmentLabel(chat: PastChat) {
  const branchLabel = chat.branchName ?? 'Unassigned'
  if (!chat.worktreeLabel) return branchLabel
  return chat.worktreeLabel === branchLabel
    ? `${branchLabel} worktree`
    : `${chat.worktreeLabel} · ${branchLabel}`
}

export function getSelectedChatDirectoryIds(
  chats: readonly PastChat[],
  chatIds: readonly string[],
) {
  const chatIdSet = new Set(chatIds)
  return [...new Set(chats.flatMap((chat) => (chatIdSet.has(chat.id) ? [chat.directoryId] : [])))]
}
