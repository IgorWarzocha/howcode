import { isSelectedConversationView } from '../extensions/toolkit-plugins'
import type { WorkspaceState } from '../state/workspace-model'

export function getLayoutThreadSelection(state: WorkspaceState) {
  const hasThreadSelection = isSelectedConversationView(state.activeView)
  return {
    conversationId: hasThreadSelection ? state.selectedConversationId : null,
    threadId: hasThreadSelection ? state.selectedThreadId : null,
  }
}
