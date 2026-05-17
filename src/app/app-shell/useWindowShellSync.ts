import type { Dispatch } from 'react'
import { useEffect } from 'react'
import { getPersistedSessionPath } from '../../../shared/session-paths'
import { watchSessionQuery } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import { isUtilityView } from '../state/workspace'

export function shouldCloseUtilityViewOnEscape(
  activeView: WorkspaceState['activeView'],
  event: Pick<KeyboardEvent, 'key' | 'defaultPrevented'>,
) {
  return isUtilityView(activeView) && event.key === 'Escape' && !event.defaultPrevented
}

export function useWatchedSessionSync(workspaceState: WorkspaceState) {
  useEffect(() => {
    const watchedSessionPath =
      workspaceState.activeView === 'chat' ||
      workspaceState.activeView === 'thread' ||
      workspaceState.activeView === 'gitops'
        ? getPersistedSessionPath(workspaceState.selectedSessionPath)
        : null

    void watchSessionQuery(watchedSessionPath).catch((error) => {
      console.warn('Failed to update watched Pi session.', error)
    })
  }, [workspaceState.activeView, workspaceState.selectedSessionPath])
}

export function useUtilityViewEscape({
  activeView,
  dispatch,
}: {
  activeView: WorkspaceState['activeView']
  dispatch: Dispatch<WorkspaceAction>
}) {
  useEffect(() => {
    if (!isUtilityView(activeView)) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldCloseUtilityViewOnEscape(activeView, event)) {
        return
      }

      dispatch({ type: 'close-utility-view' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeView, dispatch])
}
