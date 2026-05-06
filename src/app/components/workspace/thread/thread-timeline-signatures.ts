import type { Message } from '../../../types'
import { isTurnRowCollapsible, type TimelineRow } from './timeline-row'

function isToolCallRole(message: Message | undefined) {
  return message?.role === 'toolResult' || message?.role === 'bashExecution'
}

function toolGroupContainsMessage(
  item: Extract<TimelineRow, { kind: 'tool-group' }> | { kind: 'tool-group'; messages: Message[] },
  messageId: string,
) {
  return item.messages.some((message) => message.id === messageId)
}

function getStreamingToolGroupIdFromTurn(
  row: Extract<TimelineRow, { kind: 'turn' }>,
  messageId: string,
) {
  for (let itemIndex = row.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
    const item = row.items[itemIndex]
    if (item?.kind === 'tool-group' && toolGroupContainsMessage(item, messageId)) return item.id
  }
  return null
}

function getJoinedLength(parts: string[] | undefined, separatorLength: number) {
  if (!parts || parts.length === 0) {
    return 0
  }

  let length = separatorLength * (parts.length - 1)
  for (const part of parts) {
    length += part.length
  }

  return length
}

export function getMessageRenderSignature(message: Message | undefined) {
  if (!message) {
    return 'empty'
  }

  switch (message.role) {
    case 'user':
    case 'toolResult':
    case 'custom':
    case 'system':
    case 'branchSummary':
    case 'compactionSummary':
      return `${message.id}:${message.role}:${getJoinedLength(message.content, 1)}`
    case 'assistant':
      return `${message.id}:${message.role}:${getJoinedLength(message.content, 1)}:${getJoinedLength(message.thinkingContent, 1)}:${getJoinedLength(message.thinkingHeaders, 1)}`
    case 'bashExecution':
      return `${message.id}:${message.role}:${message.command.length}:${getJoinedLength(message.output, 1)}`
    default:
      return 'unknown'
  }
}

export function getStreamingAssistantMessageId(messages: Message[], isStreaming: boolean) {
  if (!isStreaming) {
    return null
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'assistant') {
      return message.id
    }
  }

  return null
}

export function getStreamingToolGroupId(
  rows: TimelineRow[],
  messages: Message[],
  isStreaming: boolean,
) {
  if (!isStreaming) {
    return null
  }

  const latestMessage = messages[messages.length - 1]
  if (!isToolCallRole(latestMessage)) {
    return null
  }

  for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
    const row = rows[rowIndex]
    if (!row) {
      continue
    }

    if (row.kind === 'tool-group' && toolGroupContainsMessage(row, latestMessage.id)) return row.id
    if (row.kind === 'turn') {
      const groupId = getStreamingToolGroupIdFromTurn(row, latestMessage.id)
      if (groupId) return groupId
    }
  }

  return null
}

export function getRowStructureSignature(
  rows: TimelineRow[],
  collapsedRowIds: Record<string, boolean>,
) {
  return rows.map((row) => getSingleRowStructureSignature(row, collapsedRowIds)).join('||')
}

function getSingleRowStructureSignature(
  row: TimelineRow,
  collapsedRowIds: Record<string, boolean>,
) {
  if (row.kind === 'history-divider') return `${row.id}:${row.hiddenCount}`
  if (row.kind === 'turn') {
    return `${row.id}:${collapsedRowIds[row.id] ? 'collapsed' : 'expanded'}:${row.items.length}`
  }
  if (row.kind === 'summary')
    return `${row.id}:${collapsedRowIds[row.id] ? 'collapsed' : 'expanded'}`
  if (row.kind === 'tool-group') return `${row.id}:${row.messages.length}`
  return `${row.id}:${row.message.id}`
}

export function getFoldableRows(rows: TimelineRow[]) {
  return rows.filter(
    (row): row is Extract<TimelineRow, { kind: 'turn' | 'summary' }> =>
      row.kind === 'summary' || (row.kind === 'turn' && isTurnRowCollapsible(row)),
  )
}

export function getCollapsibleRowKey(row: TimelineRow, collapsedRowIds: Record<string, boolean>) {
  return row.kind === 'turn' || row.kind === 'summary'
    ? `${row.id}:${collapsedRowIds[row.id] ? 'collapsed' : 'expanded'}`
    : row.id
}
