import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
export function createGitWorkspaceTransitions() {
  function openGitOpsState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'open-gitops' }>,
  ): WorkspaceState {
    return {
      ...state,
      gitDetailDirectoryId: state.selectedDirectoryId || null,
      selectedDiffFilePath: action.filePath ?? null,
    }
  }

  function closeGitOpsState(state: WorkspaceState): WorkspaceState {
    return {
      ...state,
      gitDetailDirectoryId: null,
      selectedDiffFilePath: null,
    }
  }
  return { 'open-gitops': openGitOpsState, 'close-gitops': closeGitOpsState }
}
