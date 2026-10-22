import type { Message as ModelMessage, ToolCall } from '@earendil-works/pi-ai'
import {
  CompactionEntry,
  type EntryRecord,
  type LiveState,
  type SubmissionRecord,
  ToolResultEntry,
} from '@earendil-works/pi-durable'
import type { ConversationEntryList, ConversationEntryPreview } from './conversation-entries'
import type { ChatData, Message } from './desktop-chat-contracts'
import { HarnessContextEntry } from './harness-context'
import { readTrustedInputData } from './input-origin'
import { getPersonInputData } from './people'
import {
  getFirstUserTurnTitle,
  mapAgentMessageToUiMessage,
  normalizeChatTitle,
} from './pi-message-mapper'

function entryMessageId(entry: EntryRecord, index: number) {
  return index === 0 ? String(entry.id) : `${entry.id}:${index}`
}

function withInputEntries(message: Message, inputEntryIds: readonly string[] | undefined): Message {
  return inputEntryIds ? { ...message, inputEntryIds } : message
}

type TimedToolCall = { call: ToolCall; startedAtMs: number }

function workTiming(startedAtMs: number, finishedAtMs?: number): Message['workTiming'] {
  if (!Number.isFinite(startedAtMs)) return undefined
  if (finishedAtMs !== undefined && (!Number.isFinite(finishedAtMs) || finishedAtMs < startedAtMs))
    return undefined
  return { startedAtMs, ...(finishedAtMs === undefined ? {} : { finishedAtMs }) }
}

function collectToolCalls(entries: readonly EntryRecord[]) {
  const calls = new Map<string, TimedToolCall>()
  for (const entry of entries) {
    for (const message of entry.model ?? []) {
      if (message.role !== 'assistant') continue
      for (const content of message.content) {
        if (content.type === 'toolCall')
          calls.set(content.id, { call: content, startedAtMs: message.timestamp })
      }
    }
  }
  return calls
}

function assistantWorkTiming(
  message: Extract<ModelMessage, { role: 'assistant' }>,
  running: boolean,
) {
  if (running) return workTiming(message.timestamp)
  return message.durationMs === undefined
    ? undefined
    : workTiming(message.timestamp, message.timestamp + message.durationMs)
}

function mapModelMessage(
  message: ModelMessage,
  id: string,
  calls: ReadonlyMap<string, TimedToolCall>,
  running = false,
): Message | null {
  const mapped = mapAgentMessageToUiMessage(message, 0)
  if (!mapped) return null
  mapped.id = id
  if (message.role === 'assistant') {
    const timing = assistantWorkTiming(message, running)
    if (timing) mapped.workTiming = timing
  }
  if (mapped.role === 'toolResult' && message.role === 'toolResult') {
    const source = calls.get(message.toolCallId)
    if (source) {
      mapped.rawArgs = source.call.arguments
      mapped.args = JSON.stringify(source.call.arguments, null, 2)
      const timing = workTiming(source.startedAtMs, message.timestamp)
      if (timing) mapped.workTiming = timing
    }
    mapped.details = message.details
  }
  return mapped
}

function mapEntryModelMessage(
  entry: EntryRecord,
  message: ModelMessage,
  id: string,
  calls: ReadonlyMap<string, TimedToolCall>,
) {
  const data = getPersonInputData(entry)
  const displayMessage =
    data?.modelContextBlocks === 1 && message.role === 'user' && Array.isArray(message.content)
      ? { ...message, content: message.content.slice(1) }
      : message
  const mapped = mapModelMessage(displayMessage, id, calls)
  if (mapped?.role === 'user' && data) mapped.author = data.author
  if (mapped?.role === 'toolResult' && ToolResultEntry.is(entry))
    mapped.diagnostics = entry.data.diagnostics
  const input = readTrustedInputData(entry)
  if (mapped?.role === 'user' && input) {
    mapped.input = {
      origin: input.origin,
      ...(input.semantics === undefined ? {} : { semantics: input.semantics }),
    }
  }
  return mapped
}

function mapEntries(
  entries: readonly EntryRecord[],
  calls: ReadonlyMap<string, TimedToolCall>,
  inputRelations: ReadonlyMap<string, readonly string[]> = new Map(),
): Message[] {
  return entries.flatMap((entry): Message[] => {
    if (HarnessContextEntry.is(entry)) {
      return [
        {
          id: String(entry.id),
          role: 'system',
          label: entry.data.label,
          content: [entry.data.text],
          collapsible: true,
        },
      ]
    }
    const messages: Message[] = []
    for (const [index, modelMessage] of (entry.model ?? []).entries()) {
      const mapped = mapEntryModelMessage(entry, modelMessage, entryMessageId(entry, index), calls)
      if (!mapped) continue
      messages.push(
        CompactionEntry.is(entry)
          ? {
              id: mapped.id,
              role: 'compactionSummary',
              content: 'content' in mapped ? mapped.content : mapped.output,
            }
          : withInputEntries(mapped, inputRelations.get(String(entry.id))),
      )
    }
    return messages
  })
}

/** Receipts prove inputs and final answers, not membership of historical intermediate rounds. */
function collectInputRelations(submissions: readonly SubmissionRecord[], live?: LiveState) {
  const entries = new Map<string, readonly string[]>()
  const inputs = new Map<number, string>()
  for (const submission of submissions) {
    if (submission.type !== 'input' || submission.entry === undefined) continue
    const id = String(submission.entry)
    inputs.set(submission.id, id)
    entries.set(id, [id])
    if (submission.status !== 'done') continue
    const answer = String(submission.answer)
    entries.set(answer, [...(entries.get(answer) ?? []), id])
  }
  const active = live?.run?.inputs.map((id) => inputs.get(id))
  // A watch frame and receipt scan can straddle a commit. Never claim a partial co-input set.
  const liveInputs =
    active?.length && active.every((id): id is string => id !== undefined) ? active : undefined
  if (!liveInputs) return { entries, liveInputs }
  for (const slot of live?.tools ?? []) {
    if (slot.entry !== undefined) entries.set(String(slot.entry), liveInputs)
  }
  return { entries, liveInputs }
}

function mapLiveTool(
  slot: NonNullable<LiveState['tools']>[number],
  source: TimedToolCall | undefined,
): Message {
  const call = source?.call
  const timing = source ? workTiming(source.startedAtMs) : undefined
  return {
    id: `tool:${slot.callId}`,
    role: 'toolResult',
    toolCallId: slot.callId,
    toolName: slot.name,
    content: slot.output ? [slot.output] : [],
    isError: false,
    running: true,
    ...(timing ? { workTiming: timing } : {}),
    rawArgs: call?.arguments,
    args: call ? JSON.stringify(call.arguments, null, 2) : undefined,
    details: slot.details,
    ...(slot.diagnostics === undefined ? {} : { diagnostics: slot.diagnostics }),
  }
}

function mapLiveMessages(
  conversationId: string,
  live: LiveState | undefined,
  calls: ReadonlyMap<string, TimedToolCall>,
  inputEntryIds: readonly string[] | undefined,
) {
  const messages: Message[] = []
  const partial = live?.generation?.message
  if (partial) {
    const mapped = mapModelMessage(
      partial,
      `live:${live?.run?.taskId ?? conversationId}`,
      calls,
      true,
    )
    if (mapped) messages.push(withInputEntries(mapped, inputEntryIds))
  }
  for (const slot of live?.tools ?? []) {
    if (slot.status === 'done') continue
    messages.push(withInputEntries(mapLiveTool(slot, calls.get(slot.callId)), inputEntryIds))
  }
  return messages
}

export function mapDurableEntriesToChat(input: {
  conversationId: string
  title?: string | undefined
  entries: readonly EntryRecord[]
  live?: LiveState | undefined
  submissions?: readonly SubmissionRecord[] | undefined
  previousMessageCount?: number | undefined
  hostObservedAtMs?: number | undefined
}): ChatData {
  const calls = collectToolCalls(input.entries)
  const relations = collectInputRelations(input.submissions ?? [], input.live)
  const messages = [
    ...mapEntries(input.entries, calls, relations.entries),
    ...mapLiveMessages(input.conversationId, input.live, calls, relations.liveInputs),
  ]
  return {
    conversationId: input.conversationId,
    title: input.title?.trim() ? normalizeChatTitle(input.title) : getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount: input.previousMessageCount ?? 0,
    isStreaming: Boolean(input.live?.run),
    ...(input.hostObservedAtMs === undefined ? {} : { hostObservedAtMs: input.hostObservedAtMs }),
    isCompacting: Boolean(input.live?.compactions?.length),
  }
}

export function mapDurableConversationEntries(
  entries: readonly EntryRecord[],
): ConversationEntryList {
  const calls = collectToolCalls(entries)
  return {
    entries: entries.flatMap((entry): ConversationEntryPreview[] => {
      const messages = mapEntries([entry], calls)
      const first = messages[0]
      if (!first) return []
      return [
        {
          id: String(entry.id),
          role:
            first.role === 'toolResult'
              ? 'tool'
              : first.role === 'compactionSummary' || first.role === 'branchSummary'
                ? 'summary'
                : first.role === 'user' || first.role === 'assistant'
                  ? first.role
                  : 'system',
          preview: messages
            .flatMap((message) => ('content' in message ? message.content : message.output))
            .join('\n')
            .slice(0, 240),
        },
      ]
    }),
  }
}
