import { createLocalThreadDraft } from '@howcode/shared/session-paths'
import type { Thread } from '../desktop/types'

export function getInitialThreadBranchName(branchName: unknown) {
  return typeof branchName === 'string' ? branchName.trim() || null : null
}

export function buildLocalThreadFallback(
  projectId: string,
  options: { chatGroupId?: string | null; branchName?: string | null } = {},
) {
  return createLocalThreadDraft(projectId, undefined, options)
}

export function buildOptimisticThread(input: {
  id: string
  title?: string | undefined
  sessionPath: string
  branchName?: string | undefined | null
  running?: boolean | undefined
  lastModifiedMs?: number | undefined
}): Thread {
  const thread: Thread = {
    id: input.id,
    title: input.title ?? 'New thread',
    age: 'Now',
    lastModifiedMs: input.lastModifiedMs ?? Date.now(),
    sessionPath: input.sessionPath,
    running: input.running,
  }
  const branchName = getInitialThreadBranchName(input.branchName)
  if (branchName) thread.branchName = branchName
  return thread
}
