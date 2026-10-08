import { isSelectedConversationView } from '../component-system/toolkit-components'
import type { WorkspaceState } from '../state/workspace-model'

export function getLayoutChatSelection(state: WorkspaceState) {
  const hasChatSelection = isSelectedConversationView(state.activeView)
  return {
    conversationId: hasChatSelection ? state.selectedConversationId : null,
    chatId: hasChatSelection ? state.selectedChatId : null,
  }
}
