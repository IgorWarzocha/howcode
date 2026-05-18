import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import type { PiRuntime } from './types.ts'

export type ComposerSendOutcome = 'sent' | 'stopped'

export function buildComposerSendResult(runtime: PiRuntime, outcome: ComposerSendOutcome) {
  return {
    outcome,
    sessionPath: getPersistedSessionPath(runtime.session.sessionFile),
    threadId: runtime.session.sessionId ?? null,
  }
}
