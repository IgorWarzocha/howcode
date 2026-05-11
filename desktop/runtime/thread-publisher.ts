import { stat } from 'node:fs/promises'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { ComposerState, ProseMessage, ThreadData } from '../../shared/desktop-contracts.ts'
import {
  buildThreadData,
  setThreadCompactingState,
  setThreadStreamingState,
} from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { getLatestInboxAssistantMessage } from '../../shared/thread-inbox.ts'
import { isChatSessionPath, upsertChatThread } from '../chat-state-db.ts'
import {
  beginInboxThreadTurn,
  getThreadAssistantSnapshot,
  hasInboxItem,
  setThreadRunningState,
  upsertInboxThreadMessage,
  upsertThreadSummary,
} from '../thread-state-db.ts'
import { buildComposerState } from './composer-state.ts'
import { emitDesktopEvent, subscribeDesktopEvents } from './desktop-events.ts'
import {
  getLiveThread,
  markInternalThreadUpdate,
  rememberLiveThread,
  shouldSuppressExternalThreadUpdate,
} from './live-thread-store.ts'
import { rememberSessionPath } from './session-path-index.ts'
import type { PiRuntime, RuntimeThreadReason } from './types.ts'

type RuntimeToolProgress = {
  toolCallId: string
  toolName: string
  args?: unknown
  partialResult?: { content?: unknown }
  isError?: boolean | undefined
  terminal?: boolean | undefined
}

const liveToolProgressByRuntime = new WeakMap<PiRuntime, Map<string, RuntimeToolProgress>>()

function getLiveToolProgress(runtime: PiRuntime) {
  let progress = liveToolProgressByRuntime.get(runtime)
  if (!progress) {
    progress = new Map()
    liveToolProgressByRuntime.set(runtime, progress)
  }

  return progress
}

function getLiveToolProgressMessages(runtime: PiRuntime) {
  const progress = liveToolProgressByRuntime.get(runtime)
  if (!progress || progress.size === 0) {
    return [] as AgentMessage[]
  }

  return [...progress.values()].map((entry) => {
    const content = entry.partialResult?.content
    const displayContent = hasDisplayableToolContent(content)
      ? content
      : [
          {
            type: 'text',
            text: entry.terminal
              ? entry.isError
                ? `${entry.toolName} failed.`
                : `${entry.toolName} finished.`
              : `Running ${entry.toolName}...`,
          },
        ]

    return {
      role: 'toolResult',
      toolCallId: entry.toolCallId,
      toolName: entry.toolName,
      isError: Boolean(entry.isError),
      content: displayContent,
      args: entry.args,
      running: !entry.terminal,
      timestamp: `tool-progress:${entry.toolCallId}`,
    } as unknown as AgentMessage
  })
}

function hasDisplayableToolContent(content: unknown): content is string | unknown[] {
  if (typeof content === 'string') {
    return content.trim().length > 0
  }

  if (!Array.isArray(content)) {
    return false
  }

  return content.some((part) => {
    if (typeof part === 'string') {
      return part.trim().length > 0
    }

    if (!part || typeof part !== 'object') {
      return false
    }

    const record = part as { type?: unknown; text?: unknown }
    if (record.type === 'image') {
      return true
    }

    return typeof record.text === 'string' && record.text.trim().length > 0
  })
}

export function rememberRuntimeToolProgress(runtime: PiRuntime, entry: RuntimeToolProgress) {
  getLiveToolProgress(runtime).set(entry.toolCallId, entry)
}

export function clearRuntimeToolProgress(
  runtime: PiRuntime,
  options: { toolCallId?: string | undefined; toolName?: string | undefined } = {},
) {
  const progress = liveToolProgressByRuntime.get(runtime)
  if (!progress) {
    return
  }

  if (options.toolCallId) {
    progress.delete(options.toolCallId)
  } else if (options.toolName) {
    for (const [toolCallId, entry] of progress) {
      if (entry.toolName === options.toolName) {
        progress.delete(toolCallId)
        break
      }
    }
  } else {
    progress.clear()
  }

  if (progress.size === 0) {
    liveToolProgressByRuntime.delete(runtime)
  }
}

function buildLiveThreadData(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) {
    return null
  }

  const streamingMessage = runtime.session.state.streamingMessage
  const historySlice = buildThreadHistorySlice(
    [...(runtime.session.sessionManager.getBranch() as SessionPathEntry[])],
    0,
  )
  const sourceMessages = [
    ...historySlice.sourceMessages,
    ...(streamingMessage ? [streamingMessage] : []),
    ...getLiveToolProgressMessages(runtime),
  ] as AgentMessage[]

  return buildThreadData({
    sessionPath,
    sourceMessages,
    previousMessageCount: historySlice.previousMessageCount,
    isStreaming: runtime.session.isStreaming,
    isCompacting: runtime.session.isCompacting,
  })
}

function hasAssistantMessageChanged(
  sessionPath: string,
  latestAssistantMessage: ReturnType<typeof getLatestInboxAssistantMessage>,
) {
  if (!latestAssistantMessage) {
    return false
  }

  const storedAssistantSnapshot = getThreadAssistantSnapshot(sessionPath)
  if (!storedAssistantSnapshot) {
    return true
  }

  return (
    storedAssistantSnapshot.messageJson !== JSON.stringify(latestAssistantMessage.content) ||
    storedAssistantSnapshot.preview !== latestAssistantMessage.preview
  )
}

function getLatestUserPrompt(thread: ThreadData) {
  let latestUserMessage: ProseMessage | undefined
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index]
    if (message?.role === 'user') {
      latestUserMessage = message as ProseMessage
      break
    }
  }

  if (!latestUserMessage) {
    return null
  }

  const prompt = latestUserMessage.content.join('\n\n').trim()
  return prompt.length > 0 ? prompt : null
}

export function normalizeThreadDataForReason(
  thread: ThreadData,
  reason: RuntimeThreadReason | 'external',
): ThreadData {
  if (reason === 'compaction-start') {
    return setThreadCompactingState(thread, true)
  }

  if (reason !== 'end' && reason !== 'external' && reason !== 'compaction') {
    return thread
  }

  return setThreadCompactingState(setThreadStreamingState(thread, false), false)
}

async function hasPersistedSessionFile(sessionPath: string) {
  try {
    await stat(sessionPath)
    return true
  } catch {
    return false
  }
}

function upsertPersistedThreadSummary({
  runtime,
  sessionPath,
  thread,
  timestamp,
}: {
  runtime: PiRuntime
  sessionPath: string
  thread: ThreadData
  timestamp: number
}) {
  const threadId = upsertThreadSummary({
    id: runtime.session.sessionId,
    cwd: runtime.cwd,
    sessionPath,
    title: thread.title,
    lastModifiedMs: timestamp,
  })
  if (isChatSessionPath(sessionPath)) {
    upsertChatThread({ sessionPath, groupId: runtime.chatGroupId ?? null })
  }
  return threadId
}

function updateThreadRunningState(
  sessionPath: string,
  thread: ThreadData,
  reason: RuntimeThreadReason,
) {
  setThreadRunningState(
    sessionPath,
    reason === 'update' ||
      reason === 'compaction-start' ||
      (reason === 'start' && thread.messages.length > 0),
  )
}

function updateInboxStartState(
  sessionPath: string,
  thread: ThreadData,
  reason: RuntimeThreadReason,
) {
  if (reason !== 'start') return
  const latestUserPrompt = getLatestUserPrompt(thread)
  if (latestUserPrompt || hasInboxItem(sessionPath)) {
    beginInboxThreadTurn(sessionPath, latestUserPrompt)
  }
}

function updateInboxEndState(
  sessionPath: string,
  thread: ThreadData,
  reason: RuntimeThreadReason,
  timestamp: number,
) {
  if (reason !== 'end') return
  const latestAssistantMessage = getLatestInboxAssistantMessage(thread.messages)
  if (!latestAssistantMessage) return
  upsertInboxThreadMessage({
    sessionPath,
    userPrompt: getLatestUserPrompt(thread),
    content: latestAssistantMessage.content,
    preview: latestAssistantMessage.preview,
    lastAssistantAtMs: timestamp,
  })
}

async function applyPersistedThreadUpdate(
  runtime: PiRuntime,
  sessionPath: string,
  thread: ThreadData,
  reason: RuntimeThreadReason,
  timestamp: number,
) {
  if (!(await hasPersistedSessionFile(sessionPath))) {
    return runtime.session.sessionId
  }

  const threadId = upsertPersistedThreadSummary({ runtime, sessionPath, thread, timestamp })
  updateThreadRunningState(sessionPath, thread, reason)
  updateInboxStartState(sessionPath, thread, reason)
  updateInboxEndState(sessionPath, thread, reason, timestamp)
  return threadId
}

export async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return

  markInternalThreadUpdate(sessionPath)

  const liveThread = buildLiveThreadData(runtime)
  if (!liveThread) return

  const thread = normalizeThreadDataForReason(liveThread, reason)
  const projectId = runtime.cwd
  const timestamp = Date.now()

  rememberLiveThread(sessionPath, thread)
  rememberSessionPath(sessionPath, projectId)

  const threadId = await applyPersistedThreadUpdate(runtime, sessionPath, thread, reason, timestamp)

  emitDesktopEvent({
    type: 'thread-update',
    reason,
    projectId,
    threadId,
    sessionPath,
    chatGroupId: runtime.chatGroupId ?? null,
    isChat: isChatSessionPath(sessionPath),
    thread,
    composer: await buildComposerState(runtime, { includeContextUsage: reason !== 'update' }),
  })
}

export async function publishExternalThreadUpdate({
  lastModifiedMs,
  projectId,
  sessionPath,
  thread,
  threadId,
}: {
  lastModifiedMs: number
  projectId: string
  sessionPath: string
  thread: ThreadData
  threadId: string
}) {
  thread = normalizeThreadDataForReason(thread, 'external')

  rememberLiveThread(sessionPath, thread)
  rememberSessionPath(sessionPath, projectId)
  threadId = upsertThreadSummary({
    id: threadId,
    cwd: projectId,
    sessionPath,
    title: thread.title,
    lastModifiedMs,
  })
  setThreadRunningState(sessionPath, false)

  const latestUserPrompt = getLatestUserPrompt(thread)
  const latestAssistantMessage = getLatestInboxAssistantMessage(thread.messages)

  if (!latestAssistantMessage && (latestUserPrompt || hasInboxItem(sessionPath))) {
    beginInboxThreadTurn(sessionPath, latestUserPrompt)
  }

  if (latestAssistantMessage && hasAssistantMessageChanged(sessionPath, latestAssistantMessage)) {
    upsertInboxThreadMessage({
      sessionPath,
      userPrompt: latestUserPrompt,
      content: latestAssistantMessage.content,
      preview: latestAssistantMessage.preview,
      lastAssistantAtMs: lastModifiedMs,
    })
  }

  emitDesktopEvent({
    type: 'thread-update',
    reason: 'external',
    projectId,
    threadId,
    sessionPath,
    thread,
    composer: null,
  })
}

export function publishComposerUpdate(
  composer: ComposerState,
  context: {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
  } = {},
) {
  emitDesktopEvent({
    type: 'composer-update',
    composer,
    projectId: context.projectId ?? null,
    sessionPath: context.sessionPath ?? null,
  })
}

export { getLiveThread, shouldSuppressExternalThreadUpdate, subscribeDesktopEvents }
