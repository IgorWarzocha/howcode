import type { Message, ProseMessage } from './desktop-contracts'

type AssistantMessage = ProseMessage & { role: 'assistant' }

function getCurrentTurnStartIndex(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index + 1
    }
  }
  return 0
}

function findLatestAssistantMessageInTurn(messages: Message[], turnStartIndex: number) {
  for (let index = messages.length - 1; index >= turnStartIndex; index -= 1) {
    const message = messages[index]
    if (message?.role === 'assistant' && message.content.some((part) => part.trim().length > 0)) {
      return { message: message as AssistantMessage, index }
    }
  }
  return null
}

function getNonEmptyMessageParts(message: AssistantMessage) {
  return message.content.map((part) => part.trim()).filter(Boolean)
}

function hasLaterTurnWork(messages: Message[], latestAssistantIndex: number) {
  const laterMessages = messages.slice(latestAssistantIndex + 1)
  return laterMessages.some(
    (message) =>
      message.role === 'assistant' ||
      message.role === 'user' ||
      message.role === 'toolResult' ||
      message.role === 'bashExecution',
  )
}

export function getLatestInboxAssistantMessage(messages: Message[]) {
  const turnStartIndex = getCurrentTurnStartIndex(messages)
  const latestAssistant = findLatestAssistantMessageInTurn(messages, turnStartIndex)

  if (!latestAssistant) {
    return null
  }

  const content = getNonEmptyMessageParts(latestAssistant.message)

  if (content.length === 0) {
    return null
  }

  if (hasLaterTurnWork(messages, latestAssistant.index)) {
    return null
  }

  return {
    content,
    preview: content[0] ?? null,
  }
}
