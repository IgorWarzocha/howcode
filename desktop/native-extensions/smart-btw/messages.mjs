import { MESSAGE_TYPE_PREFIX } from './constants.mjs'

export function isBtwResultMessage(message) {
  const type = message.role ?? message.type
  return (
    (type === 'custom' || type === 'custom_message') &&
    String(message.customType ?? '').startsWith(MESSAGE_TYPE_PREFIX)
  )
}

export function getResultMessageType(session, turn) {
  const turnIndex = turn.turnIndex ?? session.turns.indexOf(turn) + 1
  return `${MESSAGE_TYPE_PREFIX} ${session.index + 1}-${turnIndex}`
}

export function getClearedMessageType(session) {
  return `${MESSAGE_TYPE_PREFIX} ${session.index + 1} CLEARED`
}

export function sendResultMessage(pi, session, turn) {
  const label = getResultMessageType(session, turn)
  pi.sendMessage({
    customType: MESSAGE_TYPE_PREFIX,
    content: turn.answer || turn.error || '(no answer)',
    display: true,
    details: {
      kind: 'result',
      label,
      slot: session.index + 1,
      generation: session.generationId,
      turn: turn.turnIndex ?? session.turns.indexOf(turn) + 1,
      question: turn.question,
      answer: turn.answer,
      error: turn.error,
      startedAt: turn.startedAt,
      finishedAt: turn.finishedAt,
    },
  })
}

export function sendClearedMessage(pi, session) {
  pi.sendMessage({
    customType: MESSAGE_TYPE_PREFIX,
    content: 'cleared',
    display: false,
    details: {
      kind: 'cleared',
      label: getClearedMessageType(session),
      slot: session.index + 1,
      generation: session.generationId,
      clearedAt: Date.now(),
    },
  })
}
