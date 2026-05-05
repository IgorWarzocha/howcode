import {
  closeDesktopTerminal,
  getDesktopTerminalStatus,
  statDesktopTerminalSessionFile,
} from '../../../hooks/useDesktopTerminal'

const MAX_TERMINAL_STATUS_FAILURES_BEFORE_CLOSE = 2
type SessionFileStat = { mtimeMs: number; size: number }

const pendingTerminalCloseTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingTerminalCloseGenerations = new Map<string, number>()

function closeScheduledTerminal(sessionId: string, generation: number) {
  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return
  }

  pendingTerminalCloseTimers.delete(sessionId)
  void closeDesktopTerminal({ sessionId }).finally(() => {
    if (pendingTerminalCloseGenerations.get(sessionId) === generation) {
      pendingTerminalCloseGenerations.delete(sessionId)
    }
  })
}

export function cancelScheduledTerminalClose(sessionId: string) {
  const timer = pendingTerminalCloseTimers.get(sessionId)
  if (!timer) {
    pendingTerminalCloseGenerations.delete(sessionId)
    return
  }

  pendingTerminalCloseGenerations.set(
    sessionId,
    (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1,
  )
  clearTimeout(timer)
  pendingTerminalCloseTimers.delete(sessionId)
}

export function scheduleTerminalClose(sessionId: string, delayMs: number) {
  cancelScheduledTerminalClose(sessionId)
  const generation = (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1
  pendingTerminalCloseGenerations.set(sessionId, generation)

  const timer = setTimeout(() => {
    if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
      return
    }

    closeScheduledTerminal(sessionId, generation)
  }, delayMs)

  pendingTerminalCloseTimers.set(sessionId, timer)
}

async function pollSessionFileBeforeClosing({
  sessionId,
  pollMs,
  maxKeepAliveMs,
  previousStat,
  statusFailureCount,
  startedAt,
  generation,
}: {
  sessionId: string
  pollMs: number
  maxKeepAliveMs: number
  previousStat: SessionFileStat | null
  statusFailureCount: number
  startedAt: number
  generation: number
}) {
  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return
  }

  if (Date.now() - startedAt >= maxKeepAliveMs) {
    closeScheduledTerminal(sessionId, generation)
    return
  }

  const [currentStat, terminalStatus] = await Promise.all([
    statDesktopTerminalSessionFile(sessionId).catch(() => null),
    getDesktopTerminalStatus(sessionId).catch(() => undefined),
  ])

  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return
  }

  const terminalStillRunning =
    terminalStatus?.status === 'starting' || terminalStatus?.status === 'running'

  if (terminalStatus === undefined) {
    if (statusFailureCount + 1 >= MAX_TERMINAL_STATUS_FAILURES_BEFORE_CLOSE) {
      closeScheduledTerminal(sessionId, generation)
      return
    }

    scheduleTerminalCloseWhenSessionFileIdle({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat,
      statusFailureCount: statusFailureCount + 1,
      startedAt,
      generation,
    })
    return
  }

  if (!terminalStillRunning) {
    closeScheduledTerminal(sessionId, generation)
    return
  }

  if (!currentStat) {
    if (!previousStat) {
      closeScheduledTerminal(sessionId, generation)
      return
    }

    scheduleTerminalCloseWhenSessionFileIdle({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat: null,
      statusFailureCount: 0,
      startedAt,
      generation,
    })
    return
  }

  if (
    previousStat &&
    currentStat.mtimeMs === previousStat.mtimeMs &&
    currentStat.size === previousStat.size
  ) {
    closeScheduledTerminal(sessionId, generation)
    return
  }

  scheduleTerminalCloseWhenSessionFileIdle({
    sessionId,
    pollMs,
    maxKeepAliveMs,
    previousStat: currentStat,
    statusFailureCount: 0,
    startedAt,
    generation,
  })
}

function scheduleTerminalCloseWhenSessionFileIdle({
  sessionId,
  pollMs,
  maxKeepAliveMs,
  previousStat,
  statusFailureCount,
  startedAt,
  generation,
}: {
  sessionId: string
  pollMs: number
  maxKeepAliveMs: number
  previousStat: SessionFileStat | null
  statusFailureCount: number
  startedAt: number
  generation: number
}) {
  const timer = setTimeout(() => {
    void pollSessionFileBeforeClosing({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat,
      statusFailureCount,
      startedAt,
      generation,
    })
  }, pollMs)

  pendingTerminalCloseTimers.set(sessionId, timer)
}

export async function scheduleTerminalCloseAfterSessionFileIdle(
  sessionId: string,
  pollMs: number,
  maxKeepAliveMs: number,
) {
  cancelScheduledTerminalClose(sessionId)
  const generation = (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1
  pendingTerminalCloseGenerations.set(sessionId, generation)
  const startedAt = Date.now()
  const initialStat = await statDesktopTerminalSessionFile(sessionId).catch(() => null)

  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return
  }

  scheduleTerminalCloseWhenSessionFileIdle({
    sessionId,
    pollMs,
    maxKeepAliveMs,
    previousStat: initialStat,
    statusFailureCount: 0,
    startedAt,
    generation,
  })
}
