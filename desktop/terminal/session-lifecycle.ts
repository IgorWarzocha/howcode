import { rm } from 'node:fs/promises'
import * as Effect from 'effect/Effect'
import * as Scope from 'effect/Scope'
import type {
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from '../../shared/terminal-contracts.ts'
import { bindWorkspaceTerminalToSession } from './session-binding.ts'
import { flushSession, getTranscriptPath, nowIso, readTranscript } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { clearSessionBindings, startProcess } from './terminal-process.ts'
import { hasVisibleTerminalContent } from './terminal-visibility.ts'
import {
  createTuiSessionDetection,
  scheduleTuiSessionDetection,
  stopTuiSessionDetection,
} from './tui-session-detection.ts'
import type { PtyAdapter } from './types.ts'

export function isRestartableTerminalStatus(status: TerminalSessionSnapshot['status']) {
  return status === 'exited' || status === 'error'
}

export function ensureProcessStarted(
  store: TerminalSessionStore,
  adapter: PtyAdapter,
  record: TerminalSessionRecord,
  reason: 'started' | 'restarted',
) {
  if (record.process) return Promise.resolve()
  if (record.restartPromise) return record.restartPromise

  record.restartPromise = startProcess(store, adapter, record, reason).finally(() => {
    record.restartPromise = null
  })
  return record.restartPromise
}

function stopTerminalProcess(
  processHandle: NonNullable<TerminalSessionRecord['process']>,
  force: boolean,
) {
  if (!force) {
    processHandle.kill()
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    unsubscribe = processHandle.onExit(() => {
      unsubscribe()
      resolve()
    })

    try {
      processHandle.kill('SIGKILL')
    } catch (error) {
      unsubscribe()
      reject(error)
    }
  })
}

async function finalizeTerminalRecord(store: TerminalSessionStore, record: TerminalSessionRecord) {
  store.deleteRecord(record)
  const restartPromise = record.restartPromise
  const processHandle = record.process
  let cleanupError: unknown
  const captureError = (error: unknown) => {
    cleanupError ??= error
  }

  await stopTuiSessionDetection(record).catch(captureError)
  clearSessionBindings(record)
  record.process = null
  await (processHandle
    ? stopTerminalProcess(processHandle, record.forceKillOnClose)
    : Promise.resolve()
  ).catch(captureError)
  record.restartPromise = null
  try {
    await flushSession(record)
  } catch (error) {
    captureError(error)
  }
  await restartPromise?.catch(() => {
    // startProcess kills late PTYs after the record is removed from the scoped store.
  })

  if (record.deleteHistoryOnClose) {
    try {
      await rm(record.transcriptPath, { force: true })
    } catch (error) {
      captureError(error)
    }
  }
  store.emit({
    type: 'exited',
    sessionId: record.snapshot.sessionId,
    exitCode: null,
    exitSignal: null,
    createdAt: nowIso(),
  })
  if (cleanupError) throw cleanupError
}

export function reopenExistingTerminal(input: {
  store: TerminalSessionStore
  adapter: PtyAdapter
  record: TerminalSessionRecord
  request: TerminalOpenRequest
}) {
  input.record.snapshot = {
    ...input.record.snapshot,
    cols: input.request.cols,
    rows: input.request.rows,
    updatedAt: nowIso(),
  }

  if (input.record.process) {
    input.record.process.resize(input.request.cols, input.request.rows)
  } else if (isRestartableTerminalStatus(input.record.snapshot.status)) {
    input.record.snapshot = {
      ...input.record.snapshot,
      status: 'starting',
      exitCode: null,
      exitSignal: null,
      updatedAt: nowIso(),
    }
    void ensureProcessStarted(input.store, input.adapter, input.record, 'restarted')
  }

  return input.record.snapshot
}

export async function rebindWorkspaceTerminal(input: {
  store: TerminalSessionStore
  adapter: PtyAdapter
  record: TerminalSessionRecord
  request: TerminalOpenRequest
  sessionId: string
}) {
  const snapshot = await bindWorkspaceTerminalToSession(input)
  if (!isRestartableTerminalStatus(input.record.snapshot.status)) return snapshot

  input.record.snapshot = {
    ...input.record.snapshot,
    status: 'starting',
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  }
  void ensureProcessStarted(input.store, input.adapter, input.record, 'restarted')
  return input.record.snapshot
}

export async function createTerminalRecord(input: {
  store: TerminalSessionStore
  rootScope: Scope.Scope
  adapter: PtyAdapter
  request: TerminalOpenRequest
  sessionId: string
}) {
  const history = await readTranscript(getTranscriptPath(input.sessionId))
  const snapshot: TerminalSessionSnapshot = {
    sessionId: input.sessionId,
    projectId: input.request.projectId,
    sessionPath: input.request.sessionPath ?? null,
    cwd: input.request.cwd ?? input.request.projectId,
    launchMode: input.request.launchMode ?? 'shell',
    status: 'starting',
    pid: null,
    cols: input.request.cols,
    rows: input.request.rows,
    history,
    hasVisibleContent:
      (input.request.launchMode ?? 'shell') === 'shell' || hasVisibleTerminalContent(history),
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  }
  const sessionScope = Scope.forkUnsafe(input.rootScope)
  const record: TerminalSessionRecord = {
    scope: sessionScope,
    snapshot,
    process: null,
    restartPromise: null,
    transcriptPath: getTranscriptPath(input.sessionId),
    inputBuffer: '',
    suppressOutputVisibilityUntilInput: false,
    persistTimer: null,
    persistPromise: Promise.resolve(),
    tuiSessionDetection: createTuiSessionDetection(input.request),
    cleanup: [],
    deleteHistoryOnClose: false,
    forceKillOnClose: false,
  }

  Effect.runSync(
    Scope.addFinalizer(
      sessionScope,
      Effect.promise(() => finalizeTerminalRecord(input.store, record)),
    ),
  )
  input.store.set(input.sessionId, record)
  scheduleTuiSessionDetection(input.store, record, 'retry')
  void ensureProcessStarted(input.store, input.adapter, record, 'started')
  return snapshot
}
