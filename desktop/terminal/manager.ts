import { renameSync, rmSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { getPersistedSessionPath, isLocalSessionPath } from '../../shared/session-paths.ts'
import type {
  TerminalCloseRequest,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from '../../shared/terminal-contracts.ts'
import { publishExternalThreadUpdate } from '../pi-threads/external-thread-publisher.ts'
import { listAllSessionsStrict } from '../pi-threads/session-index.ts'
import { loadThreadSnapshot } from '../pi-threads/thread-loader.ts'
import { flushSession, getTranscriptPath, nowIso, readTranscript } from './session-history.ts'
import { makeSessionId } from './session-id.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import {
  deleteTerminalSession,
  emitTerminalEvent,
  getTerminalSession,
  listTerminalSessions,
  setTerminalSession,
  subscribeTerminalEvents,
} from './session-store.ts'
import { clearSessionBindings, startProcess } from './terminal-process.ts'
import { hasVisibleTerminalContent } from './terminal-visibility.ts'

const TUI_SESSION_DETECT_DEBOUNCE_MS = 180
const TUI_SESSION_DETECT_RETRY_MS = 700
const TUI_SESSION_DETECT_MAX_AGE_MS = 30_000

function applyTerminalInputToBuffer(buffer: string, data: string) {
  let nextBuffer = buffer
  const submittedLines: string[] = []

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      submittedLines.push(nextBuffer)
      nextBuffer = ''
      continue
    }

    if (char === '\u0003' || char === '\u0015') {
      nextBuffer = ''
      continue
    }

    if (char === '\b' || char === '\u007f') {
      nextBuffer = nextBuffer.slice(0, -1)
      continue
    }

    if (char >= ' ') {
      nextBuffer += char
    }
  }

  return { nextBuffer, submittedLines }
}

function clearTerminalHistory(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer)
    record.persistTimer = null
  }

  record.snapshot = {
    ...record.snapshot,
    history: '',
    hasVisibleContent: false,
    updatedAt: nowIso(),
  }
  record.suppressOutputVisibilityUntilInput = true
  rmSync(record.transcriptPath, { force: true })
  emitTerminalEvent({
    type: 'cleared',
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  })
}

function markTerminalVisible(record: TerminalSessionRecord) {
  if (record.snapshot.hasVisibleContent) {
    return
  }

  record.snapshot = {
    ...record.snapshot,
    hasVisibleContent: true,
    updatedAt: nowIso(),
  }
  emitTerminalEvent({
    type: 'updated',
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  })
}

function isRestartableTerminalStatus(status: TerminalSessionSnapshot['status']) {
  return status === 'exited' || status === 'error'
}

function shouldDetectTuiSession(record: TerminalSessionRecord) {
  return (
    record.snapshot.launchMode === 'pi-session' &&
    !getPersistedSessionPath(record.snapshot.sessionPath) &&
    record.tuiSessionDetection !== null &&
    !record.tuiSessionDetection.resolvedSessionPath
  )
}

function createTuiSessionDetection(
  request: TerminalOpenRequest,
): TerminalSessionRecord['tuiSessionDetection'] {
  if ((request.launchMode ?? 'shell') !== 'pi-session') return null
  if (getPersistedSessionPath(request.sessionPath)) return null
  return {
    startedAtMs: Date.now(),
    submittedPrompts: [],
    resolvedSessionPath: null,
    refreshTimer: null,
    inFlight: false,
  }
}

function getThreadUserPrompts(snapshot: Awaited<ReturnType<typeof loadThreadSnapshot>>) {
  return snapshot.thread.messages.flatMap((message) =>
    message.role === 'user'
      ? message.content.flatMap((content) => {
          const trimmed = content.trim()
          return trimmed ? [trimmed] : []
        })
      : [],
  )
}

function hasDetectedPrompt(input: {
  snapshot: Awaited<ReturnType<typeof loadThreadSnapshot>>
  submittedPrompts: string[]
}) {
  if (input.submittedPrompts.length === 0) return false
  const userPrompts = new Set(getThreadUserPrompts(input.snapshot))
  return input.submittedPrompts.some((prompt) => userPrompts.has(prompt))
}

function shouldKeepDetecting(detection: NonNullable<TerminalSessionRecord['tuiSessionDetection']>) {
  return Date.now() - detection.startedAtMs < TUI_SESSION_DETECT_MAX_AGE_MS
}

function rememberSubmittedPrompts(record: TerminalSessionRecord, submittedLines: string[]) {
  const detection = record.tuiSessionDetection
  if (!detection) return
  const submittedPromptSet = new Set(detection.submittedPrompts)

  for (const line of submittedLines) {
    const prompt = line.trim()
    if (prompt && prompt !== 'clear' && !submittedPromptSet.has(prompt)) {
      submittedPromptSet.add(prompt)
      detection.submittedPrompts.push(prompt)
    }
  }
}

async function findStartedTuiSession(record: TerminalSessionRecord) {
  const detection = record.tuiSessionDetection
  if (!detection) return null
  const { sessions } = await listAllSessionsStrict()
  const candidates = sessions.filter(
    (session) =>
      (session.cwd || record.snapshot.projectId) === record.snapshot.projectId &&
      session.created.getTime() >= detection.startedAtMs - 1_000,
  )

  for (const session of candidates) {
    const snapshot = await loadThreadSnapshot(session.path)
    if (hasDetectedPrompt({ snapshot, submittedPrompts: detection.submittedPrompts })) {
      return { session, snapshot }
    }
  }

  return null
}

async function bindDetectedTuiSession(record: TerminalSessionRecord) {
  const detection = record.tuiSessionDetection
  if (!detection || detection.inFlight || detection.resolvedSessionPath) return
  detection.inFlight = true

  try {
    const detected = await findStartedTuiSession(record)
    if (!detected) {
      if (shouldKeepDetecting(detection)) {
        scheduleTuiSessionDetection(record, TUI_SESSION_DETECT_RETRY_MS)
      }
      return
    }
    const { session, snapshot } = detected

    const replacesSessionPath = isLocalSessionPath(record.snapshot.sessionPath)
      ? record.snapshot.sessionPath
      : null
    detection.resolvedSessionPath = session.path
    record.snapshot = {
      ...record.snapshot,
      sessionPath: session.path,
      updatedAt: nowIso(),
    }
    emitTerminalEvent({
      type: 'updated',
      sessionId: record.snapshot.sessionId,
      snapshot: record.snapshot,
      createdAt: nowIso(),
    })
    await publishExternalThreadUpdate({
      projectId: snapshot.projectId,
      threadId: snapshot.threadId,
      sessionPath: session.path,
      replacesSessionPath,
      thread: snapshot.thread,
      lastModifiedMs: session.modified.getTime(),
    })
  } catch (error) {
    console.warn('Failed to detect Pi TUI session started from takeover.', error)
    if (shouldKeepDetecting(detection)) {
      scheduleTuiSessionDetection(record, TUI_SESSION_DETECT_RETRY_MS)
    }
  } finally {
    detection.inFlight = false
  }
}

function scheduleTuiSessionDetection(
  record: TerminalSessionRecord,
  delayMs = TUI_SESSION_DETECT_DEBOUNCE_MS,
) {
  if (!shouldDetectTuiSession(record)) return
  const detection = record.tuiSessionDetection
  if (!detection) return
  if (detection.refreshTimer) clearTimeout(detection.refreshTimer)
  detection.refreshTimer = setTimeout(() => {
    detection.refreshTimer = null
    void bindDetectedTuiSession(record)
  }, delayMs)
}

function ensureProcessStarted(record: TerminalSessionRecord, reason: 'started' | 'restarted') {
  if (record.process) {
    return Promise.resolve()
  }

  if (record.restartPromise) {
    return record.restartPromise
  }

  record.restartPromise = startProcess(record, reason).finally(() => {
    record.restartPromise = null
  })
  return record.restartPromise
}

function findUnboundWorkspaceShellTerminal(request: TerminalOpenRequest) {
  if (!request.sessionPath) {
    return null
  }

  const cwd = request.cwd ?? request.projectId
  return (
    listTerminalSessions().find(
      (record) =>
        record.snapshot.projectId === request.projectId &&
        record.snapshot.sessionPath === null &&
        record.snapshot.cwd === cwd &&
        record.snapshot.launchMode === (request.launchMode ?? 'shell'),
    ) ?? null
  )
}

function moveTranscript(fromPath: string, toPath: string) {
  if (fromPath === toPath) {
    return true
  }

  try {
    renameSync(fromPath, toPath)
    return true
  } catch {
    // The transcript may not have been flushed yet, or the target can already exist from a
    // previous bound terminal. Keeping the live in-memory history is more important than failing
    // the bind operation for best-effort persistence.
    return false
  }
}

function bindWorkspaceTerminalToSession(input: {
  record: TerminalSessionRecord
  request: TerminalOpenRequest
  sessionId: string
}) {
  const previousSessionId = input.record.snapshot.sessionId
  const nextTranscriptPath = getTranscriptPath(input.sessionId)

  deleteTerminalSession(previousSessionId)
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
  setTerminalSession(input.sessionId, input.record)
  input.record.process?.resize(input.request.cols, input.request.rows)
  emitTerminalEvent({
    type: 'updated',
    sessionId: input.sessionId,
    snapshot: input.record.snapshot,
    createdAt: nowIso(),
  })
  return input.record.snapshot
}

export async function openTerminal(request: TerminalOpenRequest): Promise<TerminalSessionSnapshot> {
  const cwd = request.cwd ?? request.projectId
  const sessionId = makeSessionId(request)
  const existing = getTerminalSession(sessionId)

  if (existing) {
    existing.snapshot = {
      ...existing.snapshot,
      cols: request.cols,
      rows: request.rows,
      updatedAt: nowIso(),
    }

    if (existing.process) {
      existing.process.resize(request.cols, request.rows)
    } else if (isRestartableTerminalStatus(existing.snapshot.status)) {
      existing.snapshot = {
        ...existing.snapshot,
        status: 'starting',
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      }
      void ensureProcessStarted(existing, 'restarted')
    }

    return existing.snapshot
  }

  const unboundWorkspaceTerminal = findUnboundWorkspaceShellTerminal(request)
  if (unboundWorkspaceTerminal) {
    const snapshot = bindWorkspaceTerminalToSession({
      record: unboundWorkspaceTerminal,
      request,
      sessionId,
    })
    if (isRestartableTerminalStatus(unboundWorkspaceTerminal.snapshot.status)) {
      unboundWorkspaceTerminal.snapshot = {
        ...unboundWorkspaceTerminal.snapshot,
        status: 'starting',
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      }
      void ensureProcessStarted(unboundWorkspaceTerminal, 'restarted')
      return unboundWorkspaceTerminal.snapshot
    }
    return snapshot
  }

  const history = readTranscript(getTranscriptPath(sessionId))
  const snapshot: TerminalSessionSnapshot = {
    sessionId,
    projectId: request.projectId,
    sessionPath: request.sessionPath ?? null,
    cwd,
    launchMode: request.launchMode ?? 'shell',
    status: 'starting',
    pid: null,
    cols: request.cols,
    rows: request.rows,
    history,
    hasVisibleContent:
      (request.launchMode ?? 'shell') === 'shell' || hasVisibleTerminalContent(history),
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  }

  const record: TerminalSessionRecord = {
    snapshot,
    process: null,
    restartPromise: null,
    transcriptPath: getTranscriptPath(sessionId),
    inputBuffer: '',
    suppressOutputVisibilityUntilInput: false,
    persistTimer: null,
    tuiSessionDetection: createTuiSessionDetection(request),
    cleanup: [],
  }

  setTerminalSession(sessionId, record)
  scheduleTuiSessionDetection(record, TUI_SESSION_DETECT_RETRY_MS)
  void ensureProcessStarted(record, 'started')
  return snapshot
}

export async function writeTerminal(sessionId: string, data: string) {
  const record = getTerminalSession(sessionId)
  const input = record ? applyTerminalInputToBuffer(record.inputBuffer, data) : null

  if (record && input) {
    record.inputBuffer = input.nextBuffer
    if (input.submittedLines.some((line) => line.trim() && line.trim() !== 'clear')) {
      rememberSubmittedPrompts(record, input.submittedLines)
      record.suppressOutputVisibilityUntilInput = false
      markTerminalVisible(record)
      scheduleTuiSessionDetection(record)
    }
  }

  if (!(record?.process && data.length > 0)) {
    if (record && data.length > 0 && isRestartableTerminalStatus(record.snapshot.status)) {
      record.snapshot = {
        ...record.snapshot,
        status: 'starting',
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      }
      await ensureProcessStarted(record, 'restarted')
      record.process?.write(data)
      if (input?.submittedLines.some((line) => line.trim() === 'clear')) {
        clearTerminalHistory(record)
      }
    }
    return
  }

  record.process.write(data)

  if (input?.submittedLines.some((line) => line.trim() === 'clear')) {
    clearTerminalHistory(record)
  }
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number) {
  const record = getTerminalSession(sessionId)
  if (!record) {
    return
  }

  record.snapshot = { ...record.snapshot, cols, rows, updatedAt: nowIso() }
  record.process?.resize(cols, rows)
}

export async function listTerminals(): Promise<TerminalSessionSnapshot[]> {
  return listTerminalSessions().map((record) => record.snapshot)
}

export async function getTerminalStatus(sessionId: string) {
  const record = getTerminalSession(sessionId)
  return record ? { sessionId, status: record.snapshot.status } : null
}

export async function statSessionFile(sessionId: string) {
  const record = getTerminalSession(sessionId)
  const persistedSessionPath = getPersistedSessionPath(record?.snapshot.sessionPath ?? null)
  if (!persistedSessionPath) {
    return null
  }

  try {
    const fileStat = await stat(persistedSessionPath)
    if (!fileStat.isFile()) {
      return null
    }

    return {
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    }
  } catch {
    return null
  }
}

export async function closeTerminal(request: TerminalCloseRequest) {
  const record = getTerminalSession(request.sessionId)
  if (!record) {
    return
  }

  const restartPromise = record.restartPromise
  if (record.tuiSessionDetection?.refreshTimer) {
    clearTimeout(record.tuiSessionDetection.refreshTimer)
    record.tuiSessionDetection.refreshTimer = null
  }
  clearSessionBindings(record)
  record.process?.kill()
  record.process = null
  record.restartPromise = null
  flushSession(record)
  deleteTerminalSession(request.sessionId)
  await restartPromise?.catch(() => {
    // Ignore startup races while closing; startProcess kills late PTYs once the session is gone.
  })

  if (request.deleteHistory) {
    rmSync(record.transcriptPath, { force: true })
  }

  emitTerminalEvent({
    type: 'exited',
    sessionId: request.sessionId,
    exitCode: null,
    exitSignal: null,
    createdAt: nowIso(),
  })
}

export async function closeAllTerminals() {
  const sessionIds = listTerminalSessions().map((record) => record.snapshot.sessionId)
  await Promise.all(sessionIds.map((sessionId) => closeTerminal({ sessionId })))
}

export { subscribeTerminalEvents }
