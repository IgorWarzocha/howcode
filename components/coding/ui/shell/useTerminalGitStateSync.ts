import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type { DirectoryGitState, TerminalSessionSnapshot } from '../../../../src/app/desktop/types'

type UseTerminalGitStateSyncInput = {
  listDesktopTerminals: () => Promise<TerminalSessionSnapshot[]>
  subscribeDesktopTerminal: (
    listener: (event: import('../../../../src/app/desktop/types').TerminalEvent) => void,
  ) => () => void
  enabled?: boolean
  composerDirectoryId: string
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
}

type TrackedTerminalSession = {
  directoryId: string
}

const gitRefreshDelayMs = 900

function shouldTrackTerminal(snapshot: TerminalSessionSnapshot) {
  return snapshot.status === 'starting' || snapshot.status === 'running'
}

function isSameDirectoryGitState(left: DirectoryGitState | null, right: DirectoryGitState | null) {
  if (left === right) return true
  if (!(left && right)) return false

  return (
    left.directoryId === right.directoryId &&
    left.isGitRepo === right.isGitRepo &&
    left.branch === right.branch &&
    left.fileCount === right.fileCount &&
    left.stagedFileCount === right.stagedFileCount &&
    left.unstagedFileCount === right.unstagedFileCount &&
    left.insertions === right.insertions &&
    left.deletions === right.deletions &&
    left.hasOrigin === right.hasOrigin &&
    left.originName === right.originName &&
    left.originUrl === right.originUrl &&
    left.gitOpsModeOverride === right.gitOpsModeOverride
  )
}

export function useTerminalGitStateSync({
  listDesktopTerminals,
  subscribeDesktopTerminal,
  enabled = true,
  composerDirectoryId,
  loadDirectoryGitState,
  setDirectoryGitState,
}: UseTerminalGitStateSyncInput) {
  const stateRef = useRef({ composerDirectoryId, loadDirectoryGitState, setDirectoryGitState })
  const terminalSessionsByIdRef = useRef(new Map<string, TrackedTerminalSession>())
  const refreshTimersByDirectoryIdRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    stateRef.current = { composerDirectoryId, loadDirectoryGitState, setDirectoryGitState }
  }, [composerDirectoryId, loadDirectoryGitState, setDirectoryGitState])

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const rememberSnapshot = (snapshot: TerminalSessionSnapshot) => {
      if (!shouldTrackTerminal(snapshot)) {
        terminalSessionsByIdRef.current.delete(snapshot.sessionId)
        return
      }

      terminalSessionsByIdRef.current.set(snapshot.sessionId, {
        directoryId: snapshot.directoryId,
      })
    }

    const scheduleRefresh = (directoryId: string | null | undefined) => {
      if (!directoryId || directoryId !== stateRef.current.composerDirectoryId) {
        return
      }

      const existingTimer = refreshTimersByDirectoryIdRef.current.get(directoryId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const timer = setTimeout(() => {
        refreshTimersByDirectoryIdRef.current.delete(directoryId)
        void stateRef.current.loadDirectoryGitState(directoryId).then((nextDirectoryGitState) => {
          if (directoryId === stateRef.current.composerDirectoryId) {
            stateRef.current.setDirectoryGitState((current) =>
              isSameDirectoryGitState(current, nextDirectoryGitState)
                ? current
                : nextDirectoryGitState,
            )
          }
        })
      }, gitRefreshDelayMs)

      refreshTimersByDirectoryIdRef.current.set(directoryId, timer)
    }

    void listDesktopTerminals().then((snapshots) => {
      if (disposed) return
      for (const snapshot of snapshots) {
        rememberSnapshot(snapshot)
      }
    })

    const unsubscribe = subscribeDesktopTerminal((event) => {
      if (event.type === 'started' || event.type === 'restarted' || event.type === 'updated') {
        rememberSnapshot(event.snapshot)
        scheduleRefresh(event.snapshot.directoryId)
        return
      }

      const trackedSession = terminalSessionsByIdRef.current.get(event.sessionId)
      if (!trackedSession) {
        return
      }

      if (event.type === 'output') {
        // TUI-driven agent sessions and shell commands can change branches without producing a
        // desktop chat end event. Debounce output-driven refreshes so the footer branch chip and
        // git-ops state converge while the terminal remains open.
        scheduleRefresh(trackedSession.directoryId)
        return
      }

      if (event.type === 'exited' || event.type === 'error' || event.type === 'cleared') {
        terminalSessionsByIdRef.current.delete(event.sessionId)
        scheduleRefresh(trackedSession.directoryId)
      }
    })

    return () => {
      disposed = true
      unsubscribe()
      for (const timer of refreshTimersByDirectoryIdRef.current.values()) {
        clearTimeout(timer)
      }
      refreshTimersByDirectoryIdRef.current.clear()
      terminalSessionsByIdRef.current.clear()
    }
  }, [enabled, listDesktopTerminals, subscribeDesktopTerminal])
}
