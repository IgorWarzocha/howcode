import type { WorkspaceState } from '../state/workspace-model'

export function getLayoutThreadSelection(state: WorkspaceState) {
  const hasThreadSelection =
    state.activeView === 'chat' ||
    state.activeView === 'thread' ||
    state.activeView === 'gitops' ||
    state.activeView === 'project'
  return {
    conversationId: hasThreadSelection ? state.selectedConversationId : null,
    threadId: hasThreadSelection ? state.selectedThreadId : null,
  }
}
