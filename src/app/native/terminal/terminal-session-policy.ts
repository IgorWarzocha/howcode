import { getPersistedSessionPath, isLocalSessionPath } from '@howcode/shared/session-paths'
import { hasVisibleTerminalHistory } from './terminalViewportUtils'

type TerminalLaunchMode = 'shell' | 'pi-session'

export type TerminalSessionPolicy =
  | { kind: 'shell' }
  | {
      kind: 'pi-session'
      closeWhenSessionFileIdleMs: number
      keepAliveMsOnUnmount: number
      maxKeepAliveMsOnUnmount: number
    }

export type TerminalCleanupAction =
  | { kind: 'preserve' }
  | { kind: 'close'; deleteHistory: boolean }
  | { kind: 'close-after-delay'; delayMs: number }
  | { kind: 'close-after-session-file-idle'; pollMs: number; maxKeepAliveMs: number }

export function getTerminalPersistedSessionPath(input: {
  launchMode: TerminalLaunchMode
  sessionPath: string | null
  terminalSessionPath: string | null | undefined
}) {
  if (input.launchMode === 'pi-session') {
    return (
      getPersistedSessionPath(input.terminalSessionPath ?? null) ??
      (isLocalSessionPath(input.terminalSessionPath)
        ? getPersistedSessionPath(input.sessionPath)
        : null)
    )
  }

  return getPersistedSessionPath(input.terminalSessionPath ?? input.sessionPath)
}

export function getTerminalCleanupAction(input: {
  policy: TerminalSessionPolicy
  terminalHistory: string
  terminalPersistedSessionPath: string | null
}): TerminalCleanupAction {
  if (input.policy.kind === 'shell') {
    return hasVisibleTerminalHistory(input.terminalHistory)
      ? { kind: 'preserve' }
      : { kind: 'close', deleteHistory: true }
  }
  if (input.policy.closeWhenSessionFileIdleMs > 0 && input.terminalPersistedSessionPath) {
    return {
      kind: 'close-after-session-file-idle',
      pollMs: input.policy.closeWhenSessionFileIdleMs,
      maxKeepAliveMs: input.policy.maxKeepAliveMsOnUnmount,
    }
  }
  if (input.policy.keepAliveMsOnUnmount > 0) {
    return { kind: 'close-after-delay', delayMs: input.policy.keepAliveMsOnUnmount }
  }
  return { kind: 'close', deleteHistory: false }
}
