import { searchChatData } from '../../shared/chat-search.ts'
import type { ChatData } from '../../shared/desktop-contracts.ts'
import {
  mapDurableConversationEntries,
  mapDurableEntriesToChat,
} from '../../shared/durable-message-mapper.ts'
import {
  getChatDiffPreferences,
  listArchivedChats,
  listDirectoryChats,
  listInboxChats,
} from '../chat-repository.ts'
import { readRuntimeChat } from '../durable-runtime/chats.ts'
import { readRuntimeEntries } from '../durable-runtime/host.ts'
import { mapWithConcurrency } from '../runtime/map-with-concurrency.ts'
import { ensureConversationProjection } from './conversation-projection.ts'
import { getRuntimeConversationMetadata } from './conversation-state.ts'

function attachPreferences(chat: ChatData) {
  const metadata = getRuntimeConversationMetadata(chat.conversationId)
  if (metadata?.deleted) throw new Error('Conversation was deleted.')
  return {
    ...chat,
    title: metadata?.title ?? chat.title,
    diffPreferences: getChatDiffPreferences(chat.conversationId),
  }
}

export async function loadDirectoryChats(directoryId: string) {
  await ensureConversationProjection()
  return listDirectoryChats(directoryId)
}

export async function loadArchivedChatList() {
  await ensureConversationProjection()
  return listArchivedChats()
}

export async function loadInboxChatList() {
  await ensureConversationProjection()
  return mapWithConcurrency(listInboxChats(), 6, async (item) => {
    const chat = await loadChat(item.conversationId)
    const assistant = chat.messages.findLast((message) => message.role === 'assistant')
    const user = chat.messages.findLast((message) => message.role === 'user')
    return {
      ...item,
      content: assistant && 'content' in assistant ? assistant.content : [],
      prompt: user && 'content' in user ? user.content.join('\n\n') : null,
    }
  })
}

export async function loadConversationEntries(conversationId: string) {
  return mapDurableConversationEntries(await readRuntimeEntries(conversationId))
}

export async function loadChat(
  conversationId: string,
  options?: { historyCompactions?: number | undefined },
) {
  return attachPreferences(await readRuntimeChat(conversationId, undefined, options))
}

export async function loadChatPreviewAtEntry(
  conversationId: string,
  targetEntryId: string,
  options?: { historyCompactions?: number | undefined },
) {
  return attachPreferences(await readRuntimeChat(conversationId, targetEntryId, options))
}

export async function searchChat(conversationId: string, query: string) {
  const entries = await readRuntimeEntries(conversationId)
  return searchChatData(
    attachPreferences(mapDurableEntriesToChat({ conversationId, entries })),
    query,
  )
}
