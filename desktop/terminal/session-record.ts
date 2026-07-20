import type * as Scope from 'effect/Scope'
import type { TerminalSessionSnapshot } from '../../shared/terminal-contracts.ts'
import type { PtyProcess } from './types.ts'

export type TerminalSessionRecord = {
  scope: Scope.Closeable
  snapshot: TerminalSessionSnapshot
  process: PtyProcess | null
  restartPromise: Promise<void> | null
  transcriptPath: string
  inputBuffer: string
  suppressOutputVisibilityUntilInput: boolean
  persistTimer: ReturnType<typeof setTimeout> | null
  tuiSessionDetection: {
    startedAtMs: number
    submittedPrompts: string[]
    resolvedSessionPath: string | null
    refreshTimer: ReturnType<typeof setTimeout> | null
    inFlight: Promise<void> | null
    stopped: boolean
  } | null
  cleanup: Array<() => void>
  deleteHistoryOnClose: boolean
}
