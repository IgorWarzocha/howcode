import type { Message, ProseMessage } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { mapDurableEntriesToThread } from '../../shared/durable-message-mapper.ts'
import { normalizeThreadTitle } from '../../shared/pi-message-mapper.ts'
import {
  listRuntimeConversations,
  readRuntimeConversationOrigin,
  readRuntimeEntries,
  subscribeRuntimeConversationChanges,
} from '../durable-runtime/host.ts'
import { readRuntimeThread } from '../durable-runtime/threads.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { repairConversationProjection } from '../thread-state-db.ts'
import {
  getRuntimeConversationMetadata,
  registerRuntimeConversation,
} from './conversation-state.ts'

const dirty = new Set<string>()
let startup: Promise<void> | undefined
let pending: Promise<void> | undefined
let unsubscribe: (() => void) | undefined
let closed = false

function isUser(message: Message): message is ProseMessage {
  return message.role === 'user'
}
function isAssistant(message: Message): message is ProseMessage {
  return message.role === 'assistant'
}

async function repair(conversationId: string) {
  const metadata = getRuntimeConversationMetadata(conversationId)
  if (metadata?.deleted) return
  const entries = await readRuntimeEntries(conversationId)
  const modelMessages = entries.flatMap((entry) => entry.model ?? [])
  const lastModifiedMs = modelMessages.reduce(
    (latest, message) => Math.max(latest, message.timestamp),
    0,
  )
  if (!metadata) {
    const origin = await readRuntimeConversationOrigin(conversationId)
    if (!origin?.appOwned) return
    registerRuntimeConversation({
      conversationId,
      projectId: origin.projectId ?? getDesktopWorkingDirectory(),
      branchName: origin.branchName,
      chatGroupId: origin.chatGroupId,
      isChat: origin.composerMode === 'chat',
      lastModifiedMs,
    })
  }
  const thread = await readRuntimeThread(conversationId)
  const persisted = mapDurableEntriesToThread({ conversationId, entries })
  const firstUser = persisted.messages.find(isUser)
  const assistant = persisted.messages.findLast(isAssistant)
  repairConversationProjection({
    conversationId,
    title: normalizeThreadTitle(firstUser?.content.join('\n\n')),
    lastModifiedMs,
    entryId: persisted.messages.at(-1)?.id ?? null,
    assistantId: assistant?.id ?? null,
    preview: assistant?.content.join('\n\n').slice(0, 240) ?? null,
    running: thread.isStreaming || thread.isCompacting,
  })
}

function drain() {
  if (pending) return pending
  pending = (async () => {
    while (!closed && dirty.size > 0) {
      const batch = [...dirty]
      dirty.clear()
      for (const [index, id] of batch.entries()) {
        try {
          await repair(id)
        } catch (error) {
          for (const remaining of batch.slice(index)) dirty.add(remaining)
          throw error
        }
      }
    }
  })().finally(() => {
    pending = undefined
  })
  return pending
}

export function ensureConversationProjection() {
  if (closed) return Promise.reject(new Error('Conversation projection is closed.'))
  startup ??= (async () => {
    // Collect commits before scanning. Draining after the scan closes the startup race.
    unsubscribe = await subscribeRuntimeConversationChanges((id) => {
      dirty.add(id)
      if (!startup) return
      void startup
        .then(() => drain())
        .then(() => emitDesktopEvent({ type: 'shell-state-refresh' }))
        .catch((error) => console.error('Conversation projection failed.', error))
    })
    for (const id of await listRuntimeConversations()) dirty.add(id)
    await drain()
  })().catch((error) => {
    unsubscribe?.()
    unsubscribe = undefined
    startup = undefined
    throw error
  })
  return startup.then(() => drain())
}

export async function disposeConversationProjection() {
  closed = true
  unsubscribe?.()
  await startup
  await pending
  dirty.clear()
}
