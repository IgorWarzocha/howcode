import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'
import { clampHistory, flushSession, nowIso, persistSession } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { resolveTerminalCommand, resolveTerminalEnv } from './terminal-command.helpers.ts'
import { hasVisibleTerminalContent } from './terminal-visibility.ts'
import type { PtyAdapter } from './types.ts'

export function clearSessionBindings(record: TerminalSessionRecord) {
  for (const dispose of record.cleanup) {
    try {
      dispose()
    } catch (error) {
      console.warn('Failed to dispose a terminal process callback.', error)
    }
  }

  record.cleanup = []
}

export async function startProcess(
  store: TerminalSessionStore,
  adapter: PtyAdapter,
  record: TerminalSessionRecord,
  reason: 'started' | 'restarted',
) {
  clearSessionBindings(record)
  const request = {
    projectId: record.snapshot.projectId,
    sessionPath: record.snapshot.sessionPath,
    cwd: record.snapshot.cwd,
    launchMode: record.snapshot.launchMode,
    cols: record.snapshot.cols,
    rows: record.snapshot.rows,
  } as TerminalOpenRequest
  const command = resolveTerminalCommand(request)

  try {
    const processHandle = await adapter.spawn({
      shell: command.shell,
      args: command.args,
      cwd: command.cwd ?? record.snapshot.cwd,
      cols: record.snapshot.cols,
      rows: record.snapshot.rows,
      env: resolveTerminalEnv(request),
    })

    if (store.get(record.snapshot.sessionId) !== record) {
      processHandle.kill()
      return
    }

    record.process = processHandle
    record.snapshot = {
      ...record.snapshot,
      status: 'running',
      pid: processHandle.pid,
      exitCode: null,
      exitSignal: null,
      updatedAt: nowIso(),
    }

    record.cleanup.push(
      processHandle.onData((data) => {
        record.snapshot = {
          ...record.snapshot,
          history: clampHistory(record.snapshot.history + data),
          hasVisibleContent:
            record.snapshot.hasVisibleContent ||
            (!record.suppressOutputVisibilityUntilInput && hasVisibleTerminalContent(data)),
          updatedAt: nowIso(),
        }
        persistSession(record)
        store.emit({
          type: 'output',
          sessionId: record.snapshot.sessionId,
          data,
          createdAt: nowIso(),
        })
      }),
    )

    record.cleanup.push(
      processHandle.onExit((event) => {
        record.process = null
        clearSessionBindings(record)
        record.snapshot = {
          ...record.snapshot,
          status: 'exited',
          pid: null,
          exitCode: event.exitCode,
          exitSignal: event.signal,
          updatedAt: nowIso(),
        }
        flushSession(record)
        store.emit({
          type: 'exited',
          sessionId: record.snapshot.sessionId,
          exitCode: event.exitCode,
          exitSignal: event.signal,
          createdAt: nowIso(),
        })
      }),
    )

    flushSession(record)
    store.emit({
      type: reason,
      sessionId: record.snapshot.sessionId,
      snapshot: record.snapshot,
      createdAt: nowIso(),
    })
  } catch (error) {
    if (store.get(record.snapshot.sessionId) !== record) {
      return
    }

    record.process = null
    record.snapshot = {
      ...record.snapshot,
      status: 'error',
      pid: null,
      updatedAt: nowIso(),
    }
    flushSession(record)
    store.emit({
      type: 'error',
      sessionId: record.snapshot.sessionId,
      message: error instanceof Error ? error.message : 'Unable to open terminal.',
      createdAt: nowIso(),
    })
  }
}
