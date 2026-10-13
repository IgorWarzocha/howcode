import { useEffect, useMemo, useRef, useState } from 'react'
import type { TerminalEvent, TerminalSessionSnapshot } from './desktop/types'
import type { terminalClient } from './terminal-client'

type RunningTerminalSession = {
  directoryId: string
  conversationId: string | null
}

function isRunningShellSnapshot(snapshot: TerminalSessionSnapshot) {
  return snapshot.status === 'starting' || snapshot.status === 'running'
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
    [sessionId]: { directoryId: snapshot.directoryId, conversationId: snapshot.conversationId },
  }))
}

function handleTerminalSessionEvent(
  setRunningTerminalSessionsById: React.Dispatch<
    React.SetStateAction<Record<string, RunningTerminalSession>>
  >,
  event: TerminalEvent,
) {
  if (event.type === 'started' || event.type === 'restarted') {
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

export function useRunningTerminalSessions(client: typeof terminalClient, enabled = true) {
  const { listDesktopTerminals, subscribeDesktopTerminal } = client
  const terminalEventTouchedSessionIdsRef = useRef(new Set<string>())
  const [runningTerminalSessionsById, setRunningTerminalSessionsById] = useState<
    Record<string, RunningTerminalSession>
  >({})

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    terminalEventTouchedSessionIdsRef.current.clear()
    const applySnapshots = (snapshots: TerminalSessionSnapshot[]) => {
      if (disposed) return
      const touchedSessionIds = terminalEventTouchedSessionIdsRef.current
      setRunningTerminalSessionsById((current) => ({
        ...Object.fromEntries(
          Object.entries(current).filter(([sessionId]) => touchedSessionIds.has(sessionId)),
        ),
        ...Object.fromEntries(
          snapshots.flatMap((snapshot) =>
            !touchedSessionIds.has(snapshot.sessionId) && shouldShowTerminalSnapshot(snapshot)
              ? [
                  [
                    snapshot.sessionId,
                    { directoryId: snapshot.directoryId, conversationId: snapshot.conversationId },
                  ] as const,
                ]
              : [],
          ),
        ),
      }))
    }

    const unsubscribe = subscribeDesktopTerminal((event) => {
      terminalEventTouchedSessionIdsRef.current.add(event.sessionId)
      handleTerminalSessionEvent(setRunningTerminalSessionsById, event)
    })
    void listDesktopTerminals()
      .then(applySnapshots)
      .catch((error) => console.error('Terminal inventory unavailable.', error))
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [enabled, listDesktopTerminals, subscribeDesktopTerminal])

  const terminalRunningConversationIds = useMemo(
    () =>
      new Set(
        Object.values(runningTerminalSessionsById)
          .map((session) => session.conversationId)
          .filter((conversationId): conversationId is string => typeof conversationId === 'string'),
      ),
    [runningTerminalSessionsById],
  )
  const terminalRunningWorkspaceIds = useMemo(
    () => new Set(Object.values(runningTerminalSessionsById).map((session) => session.directoryId)),
    [runningTerminalSessionsById],
  )

  return {
    terminalRunningWorkspaceIds: enabled ? terminalRunningWorkspaceIds : new Set<string>(),
    terminalRunningConversationIds: enabled ? terminalRunningConversationIds : new Set<string>(),
  }
}
