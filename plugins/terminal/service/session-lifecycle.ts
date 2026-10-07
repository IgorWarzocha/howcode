import { rm } from 'node:fs/promises'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as FiberHandle from 'effect/FiberHandle'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import type {
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from '../../../shared/terminal-contracts.ts'
import { stopTerminalProcess } from './process-stop.ts'
import { bindWorkspaceTerminalToSession } from './session-binding.ts'
import {
  flushSession,
  getTranscriptPath,
  makeTranscriptWriter,
  nowIso,
  readTranscript,
} from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { clearSessionBindings, startProcess } from './terminal-process.ts'
import type { PtyAdapter } from './types.ts'

export function isRestartableTerminalStatus(status: TerminalSessionSnapshot['status']) {
  return status === 'exited' || status === 'error'
}

export const ensureProcessStarted = Effect.fn('Terminal.ensureProcessStarted')(function* (
  store: TerminalSessionStore,
  adapter: PtyAdapter,
  record: TerminalSessionRecord,
  reason: 'started' | 'restarted',
) {
  if (record.process) return
  const pending = FiberHandle.getUnsafe(record.restart)
  const task = Option.isSome(pending)
    ? pending.value
    : yield* FiberHandle.run(
        record.restart,
        Effect.promise(() => startProcess(store, adapter, record, reason)).pipe(
          Effect.uninterruptible,
        ),
      )
  yield* Fiber.join(task)
})

function startProcessInBackground(
  store: TerminalSessionStore,
  adapter: PtyAdapter,
  record: TerminalSessionRecord,
  reason: 'started' | 'restarted',
) {
  void Effect.runPromise(ensureProcessStarted(store, adapter, record, reason)).catch((error) => {
    console.warn('Failed to finish terminal process startup.', error)
  })
}

async function finalizeTerminalRecord(store: TerminalSessionStore, record: TerminalSessionRecord) {
  store.deleteRecord(record)
  const restart = FiberHandle.getUnsafe(record.restart)
  const processHandle = record.process
  let cleanupError: unknown
  const captureError = (error: unknown) => {
    cleanupError ??= error
  }

  clearSessionBindings(record)
  record.process = null
  await (processHandle
    ? stopTerminalProcess(processHandle, record.forceKillOnClose)
    : Promise.resolve()
  ).catch(captureError)
  try {
    await flushSession(record)
  } catch (error) {
    captureError(error)
  }
  if (Option.isSome(restart)) {
    await Effect.runPromise(Fiber.join(restart.value)).catch(captureError)
  }

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
    startProcessInBackground(input.store, input.adapter, input.record, 'restarted')
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
  startProcessInBackground(input.store, input.adapter, input.record, 'restarted')
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
    conversationId: input.request.conversationId ?? null,
    cwd: input.request.cwd ?? input.request.projectId,
    status: 'starting',
    pid: null,
    cols: input.request.cols,
    rows: input.request.rows,
    history,
    hasVisibleContent: true,
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  }
  const sessionScope = Scope.forkUnsafe(input.rootScope)
  const record: TerminalSessionRecord = {
    scope: sessionScope,
    snapshot,
    process: null,
    restart: Effect.runSync(Scope.provide(FiberHandle.make<void, never>(), sessionScope)),
    transcriptPath: getTranscriptPath(input.sessionId),
    inputBuffer: '',
    suppressOutputVisibilityUntilInput: false,
    transcriptWriter: Effect.runSync(Scope.provide(makeTranscriptWriter(), sessionScope)),
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
  startProcessInBackground(input.store, input.adapter, record, 'started')
  return snapshot
}
