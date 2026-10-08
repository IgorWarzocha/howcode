import * as Schema from 'effect/Schema'
import type { ChatData } from './desktop-chat-contracts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChatData(value: unknown): value is ChatData {
  if (!isRecord(value)) return false
  const {
    customMessages,
    diffPreferences,
    isCompacting,
    isStreaming,
    messages,
    previousMessageCount,
    conversationId,
    title,
  } = value
  return (
    typeof conversationId === 'string' &&
    typeof title === 'string' &&
    Array.isArray(messages) &&
    (customMessages === undefined || Array.isArray(customMessages)) &&
    typeof previousMessageCount === 'number' &&
    typeof isStreaming === 'boolean' &&
    typeof isCompacting === 'boolean' &&
    (diffPreferences === undefined || isRecord(diffPreferences))
  )
}

export const ChatDataSchema = Schema.declare<ChatData>(isChatData, {
  identifier: 'ChatData',
})
