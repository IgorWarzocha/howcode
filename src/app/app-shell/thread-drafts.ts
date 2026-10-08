import { createLocalThreadDraft } from '@howcode/shared/conversation-ids'
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
  conversationId: string
  branchName?: string | undefined | null
  running?: boolean | undefined
  lastModifiedMs?: number | undefined
}): Thread {
  const thread: Thread = {
    id: input.id,
    title: input.title ?? 'New chat',
    age: 'Now',
    lastModifiedMs: input.lastModifiedMs ?? Date.now(),
    conversationId: input.conversationId,
    running: input.running,
  }
  const branchName = getInitialThreadBranchName(input.branchName)
  if (branchName) thread.branchName = branchName
  return thread
}
