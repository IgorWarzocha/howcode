import * as Schema from 'effect/Schema'
import { DesktopEventSchema } from './desktop-event-contracts'
import type { TerminalRpcResponse } from './terminal-rpc'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasRequestId(value: Record<string, unknown>) {
  const { requestId } = value
  return typeof requestId === 'string' || typeof requestId === 'number'
}

function isTerminalRpcExit(value: unknown) {
  if (!isRecord(value)) return false
  const { _tag, cause } = value
  if (_tag === 'Success') return Object.hasOwn(value, 'value')
  if (_tag !== 'Failure' || !Array.isArray(cause)) return false
  return cause.every((entry) => {
    if (!isRecord(entry)) return false
    const { _tag: causeTag, fiberId } = entry
    if (causeTag === 'Fail') return Object.hasOwn(entry, 'error')
    if (causeTag === 'Die') return Object.hasOwn(entry, 'defect')
    return causeTag === 'Interrupt' && (fiberId === undefined || typeof fiberId === 'number')
  })
}

function isTerminalRpcResponse(value: unknown): value is TerminalRpcResponse {
  if (!isRecord(value)) return false
  const { _tag, error, exit, values } = value
  if (typeof _tag !== 'string') return false

  switch (_tag) {
    case 'Chunk':
      return hasRequestId(value) && Array.isArray(values) && values.length > 0
    case 'Exit':
      return hasRequestId(value) && isTerminalRpcExit(exit)
    case 'Defect':
      return Object.hasOwn(value, 'defect')
    case 'Pong':
      return true
    case 'ClientProtocolError':
      return isRecord(error)
    default:
      return false
  }
}

const TerminalRpcResponseSchema = Schema.declare<TerminalRpcResponse>(isTerminalRpcResponse, {
  identifier: 'TerminalRpcResponse',
})

const ReadyMessage = Schema.Struct({
  type: Schema.Literal('ready'),
  diagnostics: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
})

const SuccessfulResponseMessage = Schema.Struct({
  type: Schema.Literal('response'),
  id: Schema.String,
  ok: Schema.Literal(true),
  result: Schema.optionalKey(Schema.Unknown),
})

const FailedResponseMessage = Schema.Struct({
  type: Schema.Literal('response'),
  id: Schema.String,
  ok: Schema.Literal(false),
  error: Schema.optionalKey(Schema.String),
  stack: Schema.optionalKey(Schema.String),
})

const DesktopEventMessage = Schema.Struct({
  type: Schema.Literal('desktop-event'),
  event: DesktopEventSchema,
})

const TerminalRpcResponseMessage = Schema.Struct({
  type: Schema.Literal('terminal-rpc-response'),
  message: TerminalRpcResponseSchema,
})

export const DesktopServiceMessageSchema = Schema.Union([
  ReadyMessage,
  SuccessfulResponseMessage,
  FailedResponseMessage,
  DesktopEventMessage,
  TerminalRpcResponseMessage,
])

export type DesktopServiceMessage = typeof DesktopServiceMessageSchema.Type
