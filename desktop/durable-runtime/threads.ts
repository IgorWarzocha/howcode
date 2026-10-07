import type {
  ConversationView,
  ConversationWatch,
  EntryRecord,
  LiveState,
} from '@earendil-works/pi-durable'
import type { ComposerStateRequest, ThreadData } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { mapDurableEntriesToThread } from '../../shared/durable-message-mapper.ts'
import { getRuntimeConversationMetadata } from '../app-service/conversation-state.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { getComposerState } from './composer.ts'
import { readRuntimeEntries, resolveConversation, runtimeContext } from './host.ts'

const watches = new Map<string, { watch: ConversationWatch; finished: Promise<void> }>()
const threads = new Map<string, ThreadData>()
const attaching = new Map<string, Promise<void>>()
let closed = false
let selectedConversationId: string | null = null
const historyWindows = new Map<string, number>()

function conversationEventContext(conversationId: string, request: ComposerStateRequest) {
  const metadata = getRuntimeConversationMetadata(conversationId)
  return {
    title: metadata?.title,
    event: {
      projectId: metadata?.projectId ?? request.projectId ?? getDesktopWorkingDirectory(),
      chatGroupId: metadata?.chatGroupId ?? request.chatGroupId,
      branchName: metadata?.branchName ?? request.branchName,
      isChat: metadata?.isChat ?? request.composerMode === 'chat',
    },
  }
}

function mapHistory(
  conversationId: string,
  entries: readonly EntryRecord[],
  live: LiveState | undefined,
  title?: string,
  historyCompactions = 0,
) {
  const markers = entries.filter((entry) => entry.head !== undefined)
  const selectedMarker = markers.at(-1 - Math.max(0, historyCompactions))
  const latestHead = selectedMarker?.head
  const beforeHead =
    latestHead === undefined ? [] : entries.filter((entry) => entry.id < latestHead)
  const previousMessageCount = mapDurableEntriesToThread({ conversationId, entries: beforeHead })
    .messages.length
  const visible =
    latestHead === undefined
      ? entries
      : entries.filter(
          (entry) =>
            entry.id >= latestHead &&
            (entry.head === undefined || !selectedMarker || entry.id >= selectedMarker.id),
        )
  return mapDurableEntriesToThread({
    conversationId,
    entries: visible,
    live,
    title,
    previousMessageCount,
  })
}

export function getLiveThread(conversationId: string) {
  return threads.get(conversationId) ?? null
}

export async function readRuntimeThread(
  conversationId: string,
  atEntryId?: string,
  options?: { historyCompactions?: number | undefined; rememberHistoryWindow?: boolean },
) {
  if (options && !atEntryId && options.rememberHistoryWindow !== false)
    historyWindows.set(conversationId, options.historyCompactions ?? 0)
  const conversation = await resolveConversation(conversationId)
  const watch = await conversation.watch(runtimeContext)
  try {
    const entries = await readRuntimeEntries(conversationId, atEntryId)
    const live = watch.value.docs['pi.live'] as LiveState | undefined
    const metadata = getRuntimeConversationMetadata(conversationId)
    return mapHistory(
      conversationId,
      entries,
      atEntryId ? undefined : live,
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
    const entries =
      newestId === undefined ? [] : await readRuntimeEntries(conversationId, String(newestId))
    const thread = mapHistory(
      conversationId,
      entries,
      live,
      title,
      historyWindows.get(conversationId) ?? 0,
    )
    const reason =
      thread.isStreaming && !running ? 'start' : !thread.isStreaming && running ? 'end' : 'update'
    running = thread.isStreaming
    threads.set(conversationId, thread)
    emitDesktopEvent({
      type: 'thread-update',
      reason,
      ...eventContext,
      threadId: conversationId,
      conversationId,
      thread,
      composer: await getComposerState(request),
    })
    if (reason === 'end') {
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
    if (result.reason === 'listener_error') {
      console.error('Conversation watch failed:', result.error)
      emitDesktopEvent({
        type: 'runtime-diagnostic',
        severity: 'error',
        message: result.error.message,
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
  if (previous && previous !== selectedConversationId && !threads.get(previous)?.isStreaming) {
    await attaching.get(previous)
    const record = watches.get(previous)
    if (record) {
      await record.watch.stop()
      await record.finished
    }
    threads.delete(previous)
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
  threads.clear()
  historyWindows.clear()
}
