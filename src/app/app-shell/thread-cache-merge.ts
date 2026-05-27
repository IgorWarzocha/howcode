import type { Thread } from '../desktop/types'

type ThreadCacheFields = Pick<Thread, 'branchName' | 'pinned' | 'unread'>

export function mergeThreadCacheFields<T extends ThreadCacheFields>(
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
