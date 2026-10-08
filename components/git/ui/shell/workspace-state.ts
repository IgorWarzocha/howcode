import type { WorkspaceAction, WorkspaceState } from '../../../../src/app/state/workspace-model'
import type { View } from '../../../../src/app/types'

export function createGitWorkspaceTransitions(terminal: {
  getTerminalStateForNextView: (
    state: WorkspaceState,
    view: View,
  ) => Pick<WorkspaceState, 'terminalVisible' | 'restoreTerminalVisibleOnGitOpsClose'>
  shouldRestoreTerminalOnGitOpsClose: (state: WorkspaceState) => boolean
}) {
  const { getTerminalStateForNextView, shouldRestoreTerminalOnGitOpsClose } = terminal
  const getGitOpsReturnView = (activeView: View, fallback: WorkspaceState['gitOpsReturnView']) =>
    activeView === 'gitops' ? fallback : activeView
  function openGitOpsState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'open-gitops' }>,
  ): WorkspaceState {
    return {
      ...state,
      activeView: 'gitops',
      terminalVisible: false,
      restoreTerminalVisibleOnGitOpsClose:
        state.activeView === 'gitops'
          ? state.restoreTerminalVisibleOnGitOpsClose
          : shouldRestoreTerminalOnGitOpsClose(state),
      gitOpsReturnView:
        action.returnView ?? getGitOpsReturnView(state.activeView, state.gitOpsReturnView),
      selectedDiffFilePath: action.filePath ?? null,
      utilityViewReturnState: null,
    }
  }

  function closeGitOpsState(state: WorkspaceState): WorkspaceState {
    return {
      ...state,
      ...getTerminalStateForNextView(state, state.gitOpsReturnView),
      activeView: state.gitOpsReturnView,
      selectedChatId: state.gitOpsReturnView === 'chat' ? state.selectedChatId : null,
      selectedConversationId:
        state.gitOpsReturnView === 'chat' ? state.selectedConversationId : null,
      selectedDiffFilePath: null,
      utilityViewReturnState: null,
    }
  }
  return { 'open-gitops': openGitOpsState, 'close-gitops': closeGitOpsState }
}
