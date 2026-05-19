import type { TerminalSessionSnapshot } from '../../shared/terminal-contracts.ts'
import type { PtyProcess } from './types.ts'

export type TerminalSessionRecord = {
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
    inFlight: boolean
  } | null
  cleanup: Array<() => void>
}
