import { createLocalChatDraft } from '@howcode/shared/conversation-ids'
import type { Chat } from '../desktop/types'

export function getInitialChatBranchName(branchName: unknown) {
  return typeof branchName === 'string' ? branchName.trim() || null : null
}

export function buildLocalChatFallback(
  directoryId: string,
  options: { workspaceId?: string | null; branchName?: string | null } = {},
) {
  return createLocalChatDraft(directoryId, undefined, options)
}

export function buildOptimisticChat(input: {
  id: string
  title?: string | undefined
  conversationId: string
  branchName?: string | undefined | null
  running?: boolean | undefined
  lastModifiedMs?: number | undefined
}): Chat {
  const chat: Chat = {
    id: input.id,
    title: input.title ?? 'New chat',
    age: 'Now',
    lastModifiedMs: input.lastModifiedMs ?? Date.now(),
    conversationId: input.conversationId,
    running: input.running,
  }
  const branchName = getInitialChatBranchName(input.branchName)
  if (branchName) chat.branchName = branchName
  return chat
}
