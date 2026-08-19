import type { InboxThread } from '../desktop/types'

export function getInboxThreadComposerMode(
  thread: Pick<InboxThread, 'branchName' | 'isChat'> | null | undefined,
): 'chat' | 'code' {
  return thread?.isChat && !thread.branchName?.trim() ? 'chat' : 'code'
}

export function getInboxThreadOpenView(
  thread: Pick<InboxThread, 'branchName' | 'isChat'>,
): 'chat' | 'thread' {
  return getInboxThreadComposerMode(thread) === 'chat' ? 'chat' : 'thread'
}
