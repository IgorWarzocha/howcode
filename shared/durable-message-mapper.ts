import type { Message as ModelMessage, ToolCall } from '@earendil-works/pi-ai'
import { CompactionEntry, type EntryRecord, type LiveState } from '@earendil-works/pi-durable'
import type { ConversationEntryList, ConversationEntryPreview } from './conversation-entries'
import type { ChatData, Message } from './desktop-chat-contracts'
import {
  getFirstUserTurnTitle,
  mapAgentMessageToUiMessage,
  normalizeChatTitle,
} from './pi-message-mapper'

function entryMessageId(entry: EntryRecord, index: number) {
  return index === 0 ? String(entry.id) : `${entry.id}:${index}`
}

function collectToolCalls(entries: readonly EntryRecord[]) {
  const calls = new Map<string, ToolCall>()
  for (const entry of entries) {
    for (const message of entry.model ?? []) {
      if (message.role !== 'assistant') continue
      for (const content of message.content) {
        if (content.type === 'toolCall') calls.set(content.id, content)
      }
    }
  }
  return calls
}

function mapModelMessage(
  message: ModelMessage,
  id: string,
  calls: ReadonlyMap<string, ToolCall>,
): Message | null {
  const mapped = mapAgentMessageToUiMessage(message, 0)
  if (!mapped) return null
  mapped.id = id
  if (mapped.role === 'toolResult' && message.role === 'toolResult') {
    const call = calls.get(message.toolCallId)
    if (call) {
      mapped.rawArgs = call.arguments
      mapped.args = JSON.stringify(call.arguments, null, 2)
    }
    mapped.details = message.details
  }
  return mapped
}

function mapEntries(
  entries: readonly EntryRecord[],
  calls: ReadonlyMap<string, ToolCall>,
): Message[] {
  return entries.flatMap((entry) => {
    const messages: Message[] = []
    for (const [index, modelMessage] of (entry.model ?? []).entries()) {
      const mapped = mapModelMessage(modelMessage, entryMessageId(entry, index), calls)
      if (!mapped) continue
      messages.push(
        CompactionEntry.is(entry)
          ? {
              id: mapped.id,
              role: 'compactionSummary',
              content: 'content' in mapped ? mapped.content : mapped.output,
            }
          : mapped,
      )
    }
    return messages
  })
}

export function mapDurableEntriesToChat(input: {
  conversationId: string
  title?: string | undefined
  entries: readonly EntryRecord[]
  live?: LiveState | undefined
  previousMessageCount?: number | undefined
}): ChatData {
  const calls = collectToolCalls(input.entries)
  const messages = mapEntries(input.entries, calls)
  const partial = input.live?.generation?.message
  if (partial) {
    const mapped = mapModelMessage(
      partial,
      `live:${input.live?.run?.taskId ?? input.conversationId}`,
      calls,
    )
    if (mapped) messages.push(mapped)
  }
  for (const slot of input.live?.tools ?? []) {
    if (slot.status === 'done') continue
    const call = calls.get(slot.callId)
    messages.push({
      id: `tool:${slot.callId}`,
      role: 'toolResult',
      toolCallId: slot.callId,
      toolName: slot.name,
      content: slot.output ? [slot.output] : [],
      isError: false,
      running: true,
      rawArgs: call?.arguments,
      args: call ? JSON.stringify(call.arguments, null, 2) : undefined,
      details: slot.details,
    })
  }
  return {
    conversationId: input.conversationId,
    title: input.title?.trim() ? normalizeChatTitle(input.title) : getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount: input.previousMessageCount ?? 0,
    isStreaming: Boolean(input.live?.run),
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
