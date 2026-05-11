import type { Message } from '../../../types'
import {
  isToolCallMessage,
  type TimelineRow,
  type TimelineTurnItem,
  type ToolCallMessage,
} from './timeline-row'

type BuildTimelineRowsInput = {
  messages: Message[]
  previousMessageCount: number
}

function isSummaryMessage(
  message: Message,
): message is Extract<Message, { role: 'branchSummary' | 'compactionSummary' }> {
  return message.role === 'branchSummary' || message.role === 'compactionSummary'
}

function isStandaloneStatusMessage(message: Message) {
  return (
    message.role === 'system' &&
    (message.label === 'Model changed' || message.label === 'Reasoning changed')
  )
}

function getToolGroupMessageKey(message: ToolCallMessage) {
  if (message.role === 'toolResult') {
    return message.toolCallId ?? message.id
  }

  return message.id
}

export function buildTimelineRows({
  messages,
  previousMessageCount,
}: BuildTimelineRowsInput): TimelineRow[] {
  const nextRows: TimelineRow[] = []
  let pendingToolMessages: ToolCallMessage[] = []
  let currentTurn: Extract<TimelineRow, { kind: 'turn' }> | null = null
  let pendingImplicitTurnId: string | null = null
  let conversationStarted = previousMessageCount > 0

  const flushPendingToolMessages = () => {
    if (pendingToolMessages.length === 0) {
      return
    }

    const firstMessage = pendingToolMessages[0]
    const toolGroupKey = pendingToolMessages.map(getToolGroupMessageKey).join(':')
    const toolGroup: Extract<TimelineTurnItem, { kind: 'tool-group' }> = {
      kind: 'tool-group',
      id: `tool-group:${toolGroupKey || firstMessage?.id || 'start'}:${pendingToolMessages.length}`,
      messages: pendingToolMessages,
    }

    if (currentTurn) {
      currentTurn.items.push(toolGroup)
    } else {
      currentTurn = {
        kind: 'turn',
        id: pendingImplicitTurnId ?? `turn:implicit:${firstMessage?.id ?? 'tool-group'}`,
        userMessage: null,
        items: [toolGroup],
      }
      pendingImplicitTurnId = null
    }

    pendingToolMessages = []
  }

  const flushCurrentTurn = () => {
    if (!currentTurn) {
      return
    }

    nextRows.push(currentTurn)
    currentTurn = null
  }

  const appendStandaloneMessage = (
    timelineMessage: Extract<TimelineTurnItem, { kind: 'message' }>,
  ) => {
    const { message } = timelineMessage
    if (isSummaryMessage(message)) {
      flushCurrentTurn()
      nextRows.push({
        kind: 'summary',
        id: `summary:${message.id}`,
        message,
      })
      pendingImplicitTurnId =
        message.role === 'compactionSummary' ? `turn:post-summary:${message.id}` : null
      return true
    }

    if (!(conversationStarted || currentTurn) && isStandaloneStatusMessage(message)) {
      flushCurrentTurn()
      nextRows.push(timelineMessage)
      pendingImplicitTurnId = null
      return true
    }

    return false
  }

  if (previousMessageCount > 0) {
    nextRows.push({
      kind: 'history-divider',
      id: `history-divider:${previousMessageCount}`,
      hiddenCount: previousMessageCount,
    })
  }

  for (const message of messages) {
    if (isToolCallMessage(message)) {
      pendingToolMessages.push(message)
      continue
    }

    flushPendingToolMessages()

    const timelineMessage: Extract<TimelineTurnItem, { kind: 'message' }> = {
      kind: 'message',
      id: message.id,
      message,
    }

    if (message.role === 'user') {
      flushCurrentTurn()
      pendingImplicitTurnId = null
      conversationStarted = true
      currentTurn = {
        kind: 'turn',
        id: `turn:${message.id}`,
        userMessage: message,
        items: [],
      }
      continue
    }

    if (appendStandaloneMessage(timelineMessage)) {
      continue
    }

    conversationStarted = true

    if (currentTurn) {
      currentTurn.items.push(timelineMessage)
    } else {
      currentTurn = {
        kind: 'turn',
        id: pendingImplicitTurnId ?? `turn:implicit:${message.id}`,
        userMessage: null,
        items: [timelineMessage],
      }
      pendingImplicitTurnId = null
    }
  }

  flushPendingToolMessages()
  flushCurrentTurn()

  return nextRows
}
