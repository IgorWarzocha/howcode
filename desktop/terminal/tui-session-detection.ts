import { getPersistedSessionPath, isLocalSessionPath } from '../../shared/session-paths.ts'
import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'
import { publishExternalThreadUpdate } from '../pi-threads/external-thread-publisher.ts'
import { listAllSessionsStrict } from '../pi-threads/session-index.ts'
import { loadThreadSnapshot } from '../pi-threads/thread-loader.ts'
import { nowIso } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import { emitTerminalEvent } from './session-store.ts'

const detectionDelayMs = 180
const detectionRetryMs = 700
const detectionMaxAgeMs = 30_000

function shouldDetect(record: TerminalSessionRecord) {
  return (
    record.snapshot.launchMode === 'pi-session' &&
    !getPersistedSessionPath(record.snapshot.sessionPath) &&
    record.tuiSessionDetection !== null &&
    !record.tuiSessionDetection.resolvedSessionPath
  )
}

export function createTuiSessionDetection(
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
  return Date.now() - detection.startedAtMs < detectionMaxAgeMs
}

export function rememberSubmittedPrompts(record: TerminalSessionRecord, submittedLines: string[]) {
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

async function findStartedSession(record: TerminalSessionRecord) {
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

async function bindDetectedSession(record: TerminalSessionRecord) {
  const detection = record.tuiSessionDetection
  if (!detection || detection.inFlight || detection.resolvedSessionPath) return
  detection.inFlight = true

  try {
    const detected = await findStartedSession(record)
    if (!detected) {
      if (shouldKeepDetecting(detection)) scheduleTuiSessionDetection(record, 'retry')
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
    if (shouldKeepDetecting(detection)) scheduleTuiSessionDetection(record, 'retry')
  } finally {
    detection.inFlight = false
  }
}

export function scheduleTuiSessionDetection(
  record: TerminalSessionRecord,
  timing: 'debounce' | 'retry' = 'debounce',
) {
  if (!shouldDetect(record)) return
  const detection = record.tuiSessionDetection
  if (!detection) return
  if (detection.refreshTimer) clearTimeout(detection.refreshTimer)
  detection.refreshTimer = setTimeout(
    () => {
      detection.refreshTimer = null
      void bindDetectedSession(record)
    },
    timing === 'retry' ? detectionRetryMs : detectionDelayMs,
  )
}

export function stopTuiSessionDetection(record: TerminalSessionRecord) {
  const timer = record.tuiSessionDetection?.refreshTimer
  if (!timer) return
  clearTimeout(timer)
  if (record.tuiSessionDetection) record.tuiSessionDetection.refreshTimer = null
}
