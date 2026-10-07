import type * as FiberHandle from 'effect/FiberHandle'
import type * as Scope from 'effect/Scope'
import type { TerminalSessionSnapshot } from '../../shared/terminal-contracts.ts'
import type { TranscriptWriter } from './session-history.ts'
import type { PtyProcess } from './types.ts'

export type TerminalSessionRecord = {
  scope: Scope.Closeable
  snapshot: TerminalSessionSnapshot
  process: PtyProcess | null
  restart: FiberHandle.FiberHandle<void, never>
  transcriptPath: string
  inputBuffer: string
  suppressOutputVisibilityUntilInput: boolean
  transcriptWriter: TranscriptWriter
  cleanup: Array<() => void>
  deleteHistoryOnClose: boolean
  forceKillOnClose: boolean
}
