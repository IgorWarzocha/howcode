import * as Schema from 'effect/Schema'
import type { ThreadData } from './desktop-thread-contracts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isThreadData(value: unknown): value is ThreadData {
  if (!isRecord(value)) return false
  const {
    customMessages,
    diffPreferences,
    isCompacting,
    isStreaming,
    messages,
    previousMessageCount,
    sessionPath,
    title,
  } = value
  return (
    typeof sessionPath === 'string' &&
    typeof title === 'string' &&
    Array.isArray(messages) &&
    (customMessages === undefined || Array.isArray(customMessages)) &&
    typeof previousMessageCount === 'number' &&
    typeof isStreaming === 'boolean' &&
    typeof isCompacting === 'boolean' &&
    (diffPreferences === undefined || isRecord(diffPreferences))
  )
}

export const ThreadDataSchema = Schema.declare<ThreadData>(isThreadData, {
  identifier: 'ThreadData',
})
