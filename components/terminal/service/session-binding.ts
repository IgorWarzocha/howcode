import type { TerminalOpenRequest } from '../../../shared/terminal-contracts.ts'
import {
  getTranscriptPath,
  moveSessionTranscript,
  nowIso,
  reportTranscriptWriteFailure,
} from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'

export function findUnboundWorkspaceShellTerminal(
  store: TerminalSessionStore,
  request: TerminalOpenRequest,
) {
  if (!request.conversationId) return null
  const cwd = request.cwd ?? request.directoryId
  return (
    store
      .list()
      .find(
        (record) =>
          record.snapshot.directoryId === request.directoryId &&
          record.snapshot.conversationId === null &&
          record.snapshot.cwd === cwd,
      ) ?? null
  )
}

export async function bindWorkspaceTerminalToSession(input: {
  store: TerminalSessionStore
  record: TerminalSessionRecord
  request: TerminalOpenRequest
  sessionId: string
}) {
  const previousSessionId = input.record.snapshot.sessionId
  const nextTranscriptPath = getTranscriptPath(input.sessionId)

  await moveSessionTranscript(input.record, nextTranscriptPath).catch(reportTranscriptWriteFailure)
  input.store.delete(previousSessionId)
  input.record.snapshot = {
    ...input.record.snapshot,
    sessionId: input.sessionId,
    conversationId: input.request.conversationId ?? null,
    cols: input.request.cols,
    rows: input.request.rows,
    updatedAt: nowIso(),
  }
  input.store.set(input.sessionId, input.record)
  input.record.process?.resize(input.request.cols, input.request.rows)
  input.store.emit({
    type: 'updated',
    sessionId: input.sessionId,
    snapshot: input.record.snapshot,
    createdAt: nowIso(),
  })
  return input.record.snapshot
}
