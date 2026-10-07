import { hasVisibleTerminalHistory } from './terminalViewportUtils'

export type TerminalCleanupAction = { kind: 'preserve' } | { kind: 'close'; deleteHistory: boolean }

export function getTerminalCleanupAction(terminalHistory: string): TerminalCleanupAction {
  return hasVisibleTerminalHistory(terminalHistory)
    ? { kind: 'preserve' }
    : { kind: 'close', deleteHistory: true }
}
