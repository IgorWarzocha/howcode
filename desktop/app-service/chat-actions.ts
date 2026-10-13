import {
  getBranchName,
  getChatId,
  getChatIds,
  getComposerRequest,
  getConversationId,
} from '../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  archiveChat,
  archiveChats,
  assignChatBranch,
  clearReadInboxChats,
  deleteChatRecord,
  dismissInboxChat,
  getChatConversationId,
  markInboxChatRead,
  renameChatTitle,
  restoreChat,
  restoreChats,
  toggleChatPinned,
} from '../chat-repository.ts'
import { openChatRuntime, startNewChat } from '../conversation-runtime.ts'
import { abortRuntimeConversation } from '../durable-runtime/host.ts'
import { deleteWorkspaceChat } from '../workspace-repository.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

const conversationCleanup = new Set<(conversationId: string) => Promise<void> | void>()

export function registerConversationCleanup(
  cleanup: (conversationId: string) => Promise<void> | void,
) {
  conversationCleanup.add(cleanup)
  return () => conversationCleanup.delete(cleanup)
}

async function deletePersistedChat(chatId: string) {
  const conversationId = getChatConversationId(chatId)
  if (conversationId) {
    await abortRuntimeConversation(conversationId)
    await Promise.all(Array.from(conversationCleanup, (cleanup) => cleanup(conversationId)))
    deleteWorkspaceChat(conversationId)
  }
  deleteChatRecord(chatId)
}

export async function deletePersistedChats(chatIds: string[]) {
  const deletedChatIds: string[] = []
  const failedChatIds: string[] = []

  const results = await [...new Set(chatIds)].reduce<
    Promise<Array<{ chatId: string; deleted: boolean }>>
  >(
    (pending, chatId) =>
      pending.then(async (completed) => {
        try {
          await deletePersistedChat(chatId)
          completed.push({ chatId, deleted: true })
        } catch (error) {
          console.warn(`Failed to delete persisted chat: ${chatId}`, error)
          completed.push({ chatId, deleted: false })
        }
        return completed
      }),
    Promise.resolve([]),
  )
  for (const { chatId, deleted } of results) {
    if (deleted) deletedChatIds.push(chatId)
    else failedChatIds.push(chatId)
  }

  return {
    deletedChatIds,
    failedChatIds,
  }
}

type ChatActionHandler = (
  payload: AnyDesktopActionPayload,
) => Promise<ActionHandlerResult> | ActionHandlerResult

async function deleteManyChatsFromPayload(payload: AnyDesktopActionPayload) {
  const chatIds = getChatIds(payload)
  if (chatIds.length === 0) return handledAction()

  const deleteResult = await deletePersistedChats(chatIds)
  if (deleteResult.failedChatIds.length > 0) {
    return handledAction({
      deletedChatIds: deleteResult.deletedChatIds,
      didMutate: deleteResult.deletedChatIds.length > 0,
      error: `Failed to delete ${deleteResult.failedChatIds.length} chat(s).`,
      failedChatIds: deleteResult.failedChatIds,
    })
  }

  return handledAction({ deletedChatIds: deleteResult.deletedChatIds })
}

function getRenameValue(payload: AnyDesktopActionPayload) {
  return typeof payload.value === 'string' ? payload.value.trim() : ''
}

async function renameChatFromPayload(payload: AnyDesktopActionPayload) {
  const chatId = getChatId(payload)
  const name = getRenameValue(payload)
  if (!(chatId && name)) return handledAction()

  const conversationId = getConversationId(payload) ?? getChatConversationId(chatId)
  if (!conversationId) return handledAction({ error: 'Chat session not found.' })

  renameChatTitle(chatId, name)
  return handledAction({ title: name, conversationId: conversationId, chatId })
}

const chatActionHandlers = {
  'chat.pin': (payload) => {
    const chatId = getChatId(payload)
    if (chatId) toggleChatPinned(chatId)
    return handledAction()
  },
  'chat.open': async (payload) => {
    const conversationId = getConversationId(payload)
    await openChatRuntime(getComposerRequest(payload))
    if (conversationId) markInboxChatRead(conversationId)
    return handledAction()
  },
  'chat.archive': (payload) => {
    const chatId = getChatId(payload)
    if (chatId) archiveChat(chatId)
    return handledAction()
  },
  'chat.archive-many': (payload) => {
    const chatIds = getChatIds(payload)
    if (chatIds.length > 0) archiveChats(chatIds)
    return handledAction()
  },
  'chat.restore': (payload) => {
    const chatId = getChatId(payload)
    if (chatId) restoreChat(chatId)
    return handledAction()
  },
  'chat.restore-many': (payload) => {
    const chatIds = getChatIds(payload)
    if (chatIds.length > 0) restoreChats(chatIds)
    return handledAction()
  },
  'chat.delete': async (payload) => {
    const chatId = getChatId(payload)
    if (chatId) await deletePersistedChat(chatId)
    return handledAction()
  },
  'chat.delete-many': deleteManyChatsFromPayload,
  'chat.rename': renameChatFromPayload,
  'chat.new': async (payload) => {
    const result = await startNewChat(getComposerRequest(payload))
    const branchName = getBranchName(payload)
    if (branchName) assignChatBranch(result.chatId, branchName)
    return handledAction(result)
  },
  'inbox.mark-read': (payload) => {
    const conversationId = getConversationId(payload)
    if (conversationId) markInboxChatRead(conversationId)
    return handledAction()
  },
  'inbox.dismiss': (payload) => {
    const conversationId = getConversationId(payload)
    if (conversationId) dismissInboxChat(conversationId)
    return handledAction()
  },
  'inbox.clear-read': (payload) => {
    const olderThanDays =
      typeof payload.olderThanDays === 'number' && Number.isFinite(payload.olderThanDays)
        ? Math.max(0, payload.olderThanDays)
        : null
    const olderThanMs =
      olderThanDays === null ? null : Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    return handledAction({ clearedCount: clearReadInboxChats(olderThanMs) })
  },
} satisfies Partial<Record<DesktopAction, ChatActionHandler>>

export async function handleChatDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ChatActionHandler>> = chatActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
