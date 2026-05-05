import { useEffect, useMemo, useRef, useState } from 'react'
import type { TerminalSessionSnapshot } from '../desktop/types'
import { listDesktopTerminals, subscribeDesktopTerminal } from '../hooks/useDesktopTerminal'

type RunningTerminalSession = {
  projectId: string
  sessionPath: string | null
}

function isRunningShellSnapshot(snapshot: TerminalSessionSnapshot) {
  return (
    snapshot.launchMode === 'shell' &&
    (snapshot.status === 'starting' || snapshot.status === 'running')
  )
}

function shouldShowTerminalSnapshot(
  snapshot: TerminalSessionSnapshot,
  openedInThisSession = false,
) {
  return isRunningShellSnapshot(snapshot) && (openedInThisSession || snapshot.hasVisibleContent)
}

function removeRunningTerminalSession(
  setRunningTerminalSessionsById: React.Dispatch<
    React.SetStateAction<Record<string, RunningTerminalSession>>
  >,
  sessionId: string,
) {
  setRunningTerminalSessionsById((current) => {
    if (!(sessionId in current)) return current
    const next = { ...current }
    delete next[sessionId]
    return next
  })
}

function upsertRunningTerminalSession(
  setRunningTerminalSessionsById: React.Dispatch<
    React.SetStateAction<Record<string, RunningTerminalSession>>
  >,
  snapshot: TerminalSessionSnapshot,
  sessionId: string,
) {
  setRunningTerminalSessionsById((current) => ({
    ...current,
    [sessionId]: { projectId: snapshot.projectId, sessionPath: snapshot.sessionPath },
  }))
}

function handleTerminalSessionEvent(
  setRunningTerminalSessionsById: React.Dispatch<
    React.SetStateAction<Record<string, RunningTerminalSession>>
  >,
  event: Parameters<typeof subscribeDesktopTerminal>[0] extends (event: infer Event) => void
    ? Event
    : never,
) {
  if (event.type === 'started' || event.type === 'restarted') {
    if (event.snapshot.launchMode === 'shell')
      upsertRunningTerminalSession(setRunningTerminalSessionsById, event.snapshot, event.sessionId)
    return
  }
  if (event.type === 'updated') {
    if (shouldShowTerminalSnapshot(event.snapshot))
      upsertRunningTerminalSession(setRunningTerminalSessionsById, event.snapshot, event.sessionId)
    else removeRunningTerminalSession(setRunningTerminalSessionsById, event.sessionId)
    return
  }
  if (event.type === 'cleared' || event.type === 'exited' || event.type === 'error') {
    removeRunningTerminalSession(setRunningTerminalSessionsById, event.sessionId)
  }
}

export function useRunningTerminalSessions() {
  const terminalEventTouchedSessionIdsRef = useRef(new Set<string>())
  const [runningTerminalSessionsById, setRunningTerminalSessionsById] = useState<
    Record<string, RunningTerminalSession>
  >({})

  useEffect(() => {
    const applySnapshots = (snapshots: TerminalSessionSnapshot[]) => {
      const touchedSessionIds = terminalEventTouchedSessionIdsRef.current
      setRunningTerminalSessionsById((current) => ({
        ...current,
        ...Object.fromEntries(
          snapshots
            .filter(
              (snapshot) =>
                !touchedSessionIds.has(snapshot.sessionId) && shouldShowTerminalSnapshot(snapshot),
            )
            .map((snapshot) => [
              snapshot.sessionId,
              { projectId: snapshot.projectId, sessionPath: snapshot.sessionPath },
            ]),
        ),
      }))
    }

    void listDesktopTerminals().then(applySnapshots)
    return subscribeDesktopTerminal((event) => {
      terminalEventTouchedSessionIdsRef.current.add(event.sessionId)
      handleTerminalSessionEvent(setRunningTerminalSessionsById, event)
    })
  }, [])

  const terminalRunningSessionPaths = useMemo(
    () =>
      new Set(
        Object.values(runningTerminalSessionsById)
          .map((session) => session.sessionPath)
          .filter((sessionPath): sessionPath is string => typeof sessionPath === 'string'),
      ),
    [runningTerminalSessionsById],
  )
  const terminalRunningProjectIds = useMemo(
    () => new Set(Object.values(runningTerminalSessionsById).map((session) => session.projectId)),
    [runningTerminalSessionsById],
  )

  return { terminalRunningProjectIds, terminalRunningSessionPaths }
}
