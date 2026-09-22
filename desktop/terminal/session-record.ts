import type * as Effect from 'effect/Effect'
import type * as Fiber from 'effect/Fiber'
import type * as FiberHandle from 'effect/FiberHandle'
import type * as Scope from 'effect/Scope'
import type { TerminalSessionSnapshot } from '../../shared/terminal-contracts.ts'
import type { TranscriptWriter } from './session-history.ts'
import type { PtyProcess } from './types.ts'

export type TuiSessionDetection = {
  startedAtMs: number
  submittedPrompts: string[]
  resolvedSessionPath: string | null
  stopped: boolean
  binding: FiberHandle.FiberHandle<void, never>
  runBinding: (
    effect: Effect.Effect<void>,
    options?: { onlyIfMissing?: boolean },
  ) => Fiber.Fiber<void>
  runScheduled: (effect: Effect.Effect<void>) => Fiber.Fiber<void>
}

export type TerminalSessionRecord = {
  scope: Scope.Closeable
  snapshot: TerminalSessionSnapshot
  process: PtyProcess | null
  restart: FiberHandle.FiberHandle<void, never>
  transcriptPath: string
  inputBuffer: string
  suppressOutputVisibilityUntilInput: boolean
  transcriptWriter: TranscriptWriter
  tuiSessionDetection: TuiSessionDetection | null
  cleanup: Array<() => void>
  deleteHistoryOnClose: boolean
  forceKillOnClose: boolean
}
