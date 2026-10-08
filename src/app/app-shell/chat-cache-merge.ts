import type { Chat } from '../desktop/types'

type ChatCacheFields = Pick<Chat, 'branchName' | 'pinned' | 'unread'>

export function mergeChatCacheFields<T extends ChatCacheFields>(
  existing: T | undefined,
  next: T,
): T {
  const nextHasBranchName = Object.hasOwn(next, 'branchName') && next.branchName !== undefined
  return {
    ...existing,
    ...next,
    branchName: nextHasBranchName ? next.branchName : existing?.branchName,
    pinned: existing?.pinned ?? next.pinned,
    unread: next.unread ?? existing?.unread,
  }
}
