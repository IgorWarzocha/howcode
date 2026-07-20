import { renameSync } from 'node:fs'
import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'
import { getTranscriptPath, nowIso } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'

export function findUnboundWorkspaceShellTerminal(
  store: TerminalSessionStore,
  request: TerminalOpenRequest,
) {
  if (!request.sessionPath) return null
  const cwd = request.cwd ?? request.projectId
  return (
    store
      .list()
      .find(
        (record) =>
          record.snapshot.projectId === request.projectId &&
          record.snapshot.sessionPath === null &&
          record.snapshot.cwd === cwd &&
          record.snapshot.launchMode === (request.launchMode ?? 'shell'),
      ) ?? null
  )
}

function moveTranscript(fromPath: string, toPath: string) {
  if (fromPath === toPath) return true

  try {
    renameSync(fromPath, toPath)
    return true
  } catch {
    // Persistence is best-effort; preserving live in-memory history takes priority.
    return false
  }
}

export function bindWorkspaceTerminalToSession(input: {
  store: TerminalSessionStore
  record: TerminalSessionRecord
  request: TerminalOpenRequest
  sessionId: string
}) {
  const previousSessionId = input.record.snapshot.sessionId
  const nextTranscriptPath = getTranscriptPath(input.sessionId)

  input.store.delete(previousSessionId)
  if (moveTranscript(input.record.transcriptPath, nextTranscriptPath)) {
    input.record.transcriptPath = nextTranscriptPath
  }
  input.record.snapshot = {
    ...input.record.snapshot,
    sessionId: input.sessionId,
    sessionPath: input.request.sessionPath ?? null,
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
