const ANSI_ESCAPE = String.fromCharCode(27)
const ansiControlSequencePattern = /^\[[0-?]*[ -/]*[@-~]/

export function hasVisibleTerminalContent(history: string) {
  return (
    history
      .split(ANSI_ESCAPE)
      .map((segment, index) =>
        index === 0 ? segment : segment.replace(ansiControlSequencePattern, ''),
      )
      .join('')
      .trim().length > 0
  )
}
