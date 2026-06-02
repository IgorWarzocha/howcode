import { MESSAGE_TYPE_PREFIX } from './constants.mjs'

export function isBtwResultMessage(message) {
  return (
    message.role === 'custom' && String(message.customType ?? '').startsWith(MESSAGE_TYPE_PREFIX)
  )
}

export function getResultMessageType(session, turn) {
  const turnIndex = session.turns.indexOf(turn) + 1
  return `${MESSAGE_TYPE_PREFIX} ${session.index + 1}-${turnIndex}`
}

export function sendResultMessage(pi, session, turn) {
  pi.sendMessage({
    customType: getResultMessageType(session, turn),
    content: turn.answer || turn.error || '(no answer)',
    display: false,
    details: {
      question: turn.question,
      answer: turn.answer,
      error: turn.error,
      startedAt: turn.startedAt,
      finishedAt: turn.finishedAt,
    },
  })
}
