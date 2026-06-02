export function getFinalOutput(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    for (const part of message.content ?? []) if (part.type === 'text') return part.text
  }
  return ''
}

export function doneTurns(turns) {
  return turns.filter((turn) => turn.answer || turn.error)
}

export function injectionText(turns) {
  const completed = doneTurns(turns)
  if (completed.length === 1) {
    const turn = completed[0]
    return [
      'The user asked the following question in a separate session:',
      turn.question,
      'The answer was:',
      turn.answer || turn.error || '(no answer)',
      'Take it into account while executing the current task.',
    ].join('\n')
  }
  return [
    'The user asked the following questions in a separate session:',
    ...completed.flatMap((turn, index) => [
      '',
      `Question ${index + 1}:`,
      turn.question,
      'Answer:',
      turn.answer || turn.error || '(no answer)',
    ]),
    '',
    'Take them into account while executing the current task.',
  ].join('\n')
}
