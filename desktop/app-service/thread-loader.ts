import type { ThreadData } from '../../shared/desktop-contracts.ts'
import {
  mapDurableConversationEntries,
  mapDurableEntriesToThread,
} from '../../shared/durable-message-mapper.ts'
import { searchThreadData } from '../../shared/thread-search.ts'
import { readRuntimeEntries } from '../durable-runtime/host.ts'
import { readRuntimeThread } from '../durable-runtime/threads.ts'
import { mapWithConcurrency } from '../runtime/map-with-concurrency.ts'
import {
  getThreadDiffPreferences,
  listArchivedThreads,
  listInboxThreads,
  listProjectThreads,
} from '../thread-state-db.ts'
import { ensureConversationProjection } from './conversation-projection.ts'
import { getRuntimeConversationMetadata } from './conversation-state.ts'

function attachPreferences(thread: ThreadData) {
  const metadata = getRuntimeConversationMetadata(thread.conversationId)
  if (metadata?.deleted) throw new Error('Conversation was deleted.')
  return {
    ...thread,
    title: metadata?.title ?? thread.title,
    diffPreferences: getThreadDiffPreferences(thread.conversationId),
  }
}

export async function loadProjectThreads(
  projectId: string,
  options: { chat?: boolean | undefined } = {},
) {
  await ensureConversationProjection()
  return listProjectThreads(projectId, options)
}

export async function loadArchivedThreadList() {
  await ensureConversationProjection()
  return listArchivedThreads()
}

export async function loadInboxThreadList() {
  await ensureConversationProjection()
  return mapWithConcurrency(listInboxThreads(), 6, async (item) => {
    const thread = await loadThread(item.conversationId)
    const assistant = thread.messages.findLast((message) => message.role === 'assistant')
    const user = thread.messages.findLast((message) => message.role === 'user')
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

export async function loadThread(
  conversationId: string,
  options?: { historyCompactions?: number | undefined },
) {
  return attachPreferences(await readRuntimeThread(conversationId, undefined, options))
}

export async function loadThreadPreviewAtEntry(
  conversationId: string,
  targetEntryId: string,
  options?: { historyCompactions?: number | undefined },
) {
  return attachPreferences(await readRuntimeThread(conversationId, targetEntryId, options))
}

export async function searchThread(conversationId: string, query: string) {
  const entries = await readRuntimeEntries(conversationId)
  return searchThreadData(
    attachPreferences(mapDurableEntriesToThread({ conversationId, entries })),
    query,
  )
}
