import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { Dispatch } from 'react'
import { useEffect } from 'react'
import { watchConversationQuery } from '../query/desktop-query'
import { isUtilityView } from '../state/workspace'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'

export function shouldCloseUtilityViewOnEscape(
  activeView: WorkspaceState['activeView'],
  event: Pick<KeyboardEvent, 'key' | 'defaultPrevented'>,
) {
  return isUtilityView(activeView) && event.key === 'Escape' && !event.defaultPrevented
}

export function useWatchedConversationSync(workspaceState: WorkspaceState) {
  useEffect(() => {
    const watchedConversationId =
      workspaceState.activeView === 'chat' || workspaceState.activeView === 'gitops'
        ? getPersistedConversationId(workspaceState.selectedConversationId)
        : null

    void watchConversationQuery(watchedConversationId).catch((error) => {
      console.warn('Failed to watch conversation.', error)
    })
  }, [workspaceState.activeView, workspaceState.selectedConversationId])
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
