import type {
  ConversationView,
  ConversationWatch,
  EntryRecord,
  LiveState,
  SubmissionRecord,
} from '@earendil-works/pi-durable'
import type { ChatData, ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { mapDurableEntriesToChat } from '../../shared/durable-message-mapper.ts'
import { getRuntimeConversationMetadata } from '../app-service/conversation-state.ts'
import { freezePluginTurn } from '../plugins/runtime.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { getComposerState } from './composer.ts'
import {
  readRuntimeEntries,
  readRuntimeInputSubmissions,
  resolveConversation,
  runtimeContext,
} from './host.ts'

const watches = new Map<string, { watch: ConversationWatch; finished: Promise<void> }>()
const chats = new Map<string, ChatData>()
const attaching = new Map<string, Promise<void>>()
let closed = false
let selectedConversationId: string | null = null
const historyWindows = new Map<string, number>()

function conversationEventContext(conversationId: string, request: ComposerStateRequest) {
  const metadata = getRuntimeConversationMetadata(conversationId)
  return {
    title: metadata?.title,
    event: {
      directoryId: metadata?.directoryId ?? request.directoryId ?? getDesktopWorkingDirectory(),
      workspaceId: metadata?.workspaceId ?? request.workspaceId,
      branchName: metadata?.branchName ?? request.branchName,
    },
  }
}

function mapHistory(
  conversationId: string,
  entries: readonly EntryRecord[],
  live: LiveState | undefined,
  submissions: readonly SubmissionRecord[],
  title?: string,
  historyCompactions = 0,
) {
  const markers = entries.filter((entry) => entry.head !== undefined)
  const selectedMarker = markers.at(-1 - Math.max(0, historyCompactions))
  const latestHead = selectedMarker?.head
  const beforeHead =
    latestHead === undefined ? [] : entries.filter((entry) => entry.id < latestHead)
  const previousMessageCount = mapDurableEntriesToChat({ conversationId, entries: beforeHead })
    .messages.length
  const visible =
    latestHead === undefined
      ? entries
      : entries.filter(
          (entry) =>
            entry.id >= latestHead &&
            (entry.head === undefined || !selectedMarker || entry.id >= selectedMarker.id),
        )
  return mapDurableEntriesToChat({
    conversationId,
    entries: visible,
    live,
    submissions,
    title,
    previousMessageCount,
  })
}

export function getLiveChat(conversationId: string) {
  return chats.get(conversationId) ?? null
}

export async function readRuntimeChat(
  conversationId: string,
  atEntryId?: string,
  options?: { historyCompactions?: number | undefined; rememberHistoryWindow?: boolean },
) {
  if (options && !atEntryId && options.rememberHistoryWindow !== false)
    historyWindows.set(conversationId, options.historyCompactions ?? 0)
  const conversation = await resolveConversation(conversationId)
  const watch = await conversation.watch(runtimeContext)
  try {
    const [entries, submissions] = await Promise.all([
      readRuntimeEntries(conversationId, atEntryId),
      readRuntimeInputSubmissions(conversationId),
    ])
    const live = watch.value.docs['pi.live'] as LiveState | undefined
    const metadata = getRuntimeConversationMetadata(conversationId)
    return mapHistory(
      conversationId,
      entries,
      atEntryId ? undefined : live,
      submissions,
      metadata?.title,
      options?.historyCompactions ?? 0,
    )
  } finally {
    await watch.stop()
  }
}

async function attachConversationWatch(request: ComposerStateRequest & { conversationId: string }) {
  const conversationId = request.conversationId
  if (watches.has(conversationId)) return
  const conversation = await resolveConversation(conversationId)
  const watch = await conversation.watch(runtimeContext)
  let running = false
  let finished = Promise.resolve()
  const publish = async (value: ConversationView) => {
    // The typed built-in document is adopted by Durable in this exact watch frame.
    const live = value.docs['pi.live'] as LiveState | undefined
    const { title, event: eventContext } = conversationEventContext(conversationId, request)
    const newestId = value.entries.at(-1)?.id
    const [entries, submissions] = await Promise.all([
      newestId === undefined ? [] : readRuntimeEntries(conversationId, String(newestId)),
      readRuntimeInputSubmissions(conversationId),
    ])
    const chat = mapHistory(
      conversationId,
      entries,
      live,
      submissions,
      title,
      historyWindows.get(conversationId) ?? 0,
    )
    const reason =
      chat.isStreaming && !running ? 'start' : !chat.isStreaming && running ? 'end' : 'update'
    running = chat.isStreaming
    chats.set(conversationId, chat)
    emitDesktopEvent({
      type: 'chat-update',
      reason,
      ...eventContext,
      chatId: conversationId,
      conversationId,
      chat,
      composer: await getComposerState(request),
    })
    if (reason === 'end') {
      await freezePluginTurn(conversationId)
      if (selectedConversationId !== conversationId) await watch.stop()
    }
  }
  watches.set(conversationId, { watch, finished })
  finished = publish(watch.value)
  const record = watches.get(conversationId)
  if (record) record.finished = finished
  try {
    await finished
    watch.start(async (value) => {
      finished = publish(value)
      const current = watches.get(conversationId)
      if (current) current.finished = finished
      await finished
    })
  } catch (error) {
    if (watches.get(conversationId)?.watch === watch) watches.delete(conversationId)
    await watch.stop()
    throw error
  }
  void watch.closed.then((result) => {
    if (watches.get(conversationId)?.watch !== watch) return
    watches.delete(conversationId)
    if (result.reason === 'listener_error' || result.reason === 'session_failed') {
      console.error('Conversation watch failed:', result.error)
      emitDesktopEvent({
        type: 'runtime-diagnostic',
        severity: 'error',
        message: result.error instanceof Error ? result.error.message : String(result.error),
        conversationId,
      })
    }
  })
}

export async function selectRuntimeConversation(
  request: (ComposerStateRequest & { conversationId: string }) | null,
) {
  const previous = selectedConversationId
  selectedConversationId = request?.conversationId ?? null
  if (previous && previous !== selectedConversationId && !chats.get(previous)?.isStreaming) {
    await attaching.get(previous)
    const record = watches.get(previous)
    if (record) {
      await record.watch.stop()
      await record.finished
    }
    chats.delete(previous)
  }
  if (request) await watchRuntimeConversation(request)
}

export function watchRuntimeConversation(
  request: ComposerStateRequest & { conversationId: string },
) {
  if (closed) return Promise.reject(new Error('Conversation watches are closed.'))
  const existing = attaching.get(request.conversationId)
  if (existing) return existing
  const pending = attachConversationWatch(request).finally(() =>
    attaching.delete(request.conversationId),
  )
  attaching.set(request.conversationId, pending)
  return pending
}

export async function disposeRuntimeWatches() {
  closed = true
  await Promise.allSettled(attaching.values())
  const active = [...watches.values()]
  watches.clear()
  await Promise.all(
    active.map(async ({ watch, finished }) => {
      await watch.stop()
      await finished
    }),
  )
  chats.clear()
  historyWindows.clear()
}
