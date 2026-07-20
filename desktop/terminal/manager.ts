import { stat } from 'node:fs/promises'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import type {
  TerminalCloseRequest,
  TerminalOpenRequest,
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from '../../shared/terminal-contracts.ts'
import { findUnboundWorkspaceShellTerminal } from './session-binding.ts'
import { nowIso } from './session-history.ts'
import { makeSessionId } from './session-id.ts'
import {
  createTerminalRecord,
  ensureProcessStarted,
  isRestartableTerminalStatus,
  rebindWorkspaceTerminal,
  reopenExistingTerminal,
} from './session-lifecycle.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { clearTerminalHistory, didSubmitClear, rememberTerminalInput } from './terminal-input.ts'
import type { PtyAdapter } from './types.ts'

export interface TerminalManager {
  readonly closeAllTerminals: () => Promise<void>
  readonly closeTerminal: (request: TerminalCloseRequest) => Promise<void>
  readonly getTerminalStatus: (sessionId: string) => Promise<TerminalStatusSnapshot>
  readonly listTerminals: () => Promise<TerminalSessionSnapshot[]>
  readonly openTerminal: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>
  readonly resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
  readonly statSessionFile: (sessionId: string) => Promise<TerminalSessionFileStat | null>
  readonly writeTerminal: (sessionId: string, data: string) => Promise<void>
}

export function makeTerminalManager(
  store: TerminalSessionStore,
  rootScope: Scope.Scope,
  adapter: PtyAdapter,
): TerminalManager {
  async function openTerminal(request: TerminalOpenRequest): Promise<TerminalSessionSnapshot> {
    const sessionId = makeSessionId(request)
    const existing = store.get(sessionId)
    if (existing) return reopenExistingTerminal({ store, adapter, record: existing, request })

    const unboundWorkspaceTerminal = findUnboundWorkspaceShellTerminal(store, request)
    if (unboundWorkspaceTerminal) {
      return rebindWorkspaceTerminal({
        store,
        adapter,
        record: unboundWorkspaceTerminal,
        request,
        sessionId,
      })
    }

    return createTerminalRecord({ store, rootScope, adapter, request, sessionId })
  }

  async function writeTerminal(sessionId: string, data: string) {
    const record = store.get(sessionId)
    if (!record) return
    const input = rememberTerminalInput(store, record, data)
    if (data.length === 0) return

    if (!record.process && isRestartableTerminalStatus(record.snapshot.status)) {
      record.snapshot = {
        ...record.snapshot,
        status: 'starting',
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      }
      await ensureProcessStarted(store, adapter, record, 'restarted')
    }

    record.process?.write(data)
    if (didSubmitClear(input)) clearTerminalHistory(store, record)
  }

  async function resizeTerminal(sessionId: string, cols: number, rows: number) {
    const record = store.get(sessionId)
    if (!record) return
    record.snapshot = { ...record.snapshot, cols, rows, updatedAt: nowIso() }
    record.process?.resize(cols, rows)
  }

  async function listTerminals(): Promise<TerminalSessionSnapshot[]> {
    return store.list().map((record) => record.snapshot)
  }

  async function getTerminalStatus(sessionId: string) {
    const record = store.get(sessionId)
    return record ? { sessionId, status: record.snapshot.status } : null
  }

  async function statSessionFile(sessionId: string) {
    const record = store.get(sessionId)
    const persistedSessionPath = getPersistedSessionPath(record?.snapshot.sessionPath ?? null)
    if (!persistedSessionPath) return null

    try {
      const fileStat = await stat(persistedSessionPath)
      return fileStat.isFile() ? { mtimeMs: fileStat.mtimeMs, size: fileStat.size } : null
    } catch {
      return null
    }
  }

  async function closeTerminal(request: TerminalCloseRequest) {
    const record = store.get(request.sessionId)
    if (!record) return
    record.deleteHistoryOnClose = request.deleteHistory === true
    await Effect.runPromise(Scope.close(record.scope, Exit.void))
  }

  async function closeAllTerminals() {
    const sessionIds = store.list().map((record) => record.snapshot.sessionId)
    await Promise.all(sessionIds.map((sessionId) => closeTerminal({ sessionId })))
  }

  return {
    closeAllTerminals,
    closeTerminal,
    getTerminalStatus,
    listTerminals,
    openTerminal,
    resizeTerminal,
    statSessionFile,
    writeTerminal,
  }
}
