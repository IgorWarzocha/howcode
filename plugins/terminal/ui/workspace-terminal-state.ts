import { isLocalConversationId } from '../../../shared/conversation-ids'
import type { WorkspaceAction, WorkspaceState } from '../../../src/app/state/workspace-model'
import type { View } from '../../../src/app/types'

export function getTerminalVisibilityForSession(
  terminalVisibleBySession: Record<string, boolean>,
  conversationId: string | null,
) {
  return conversationId ? (terminalVisibleBySession[conversationId] ?? false) : false
}

export function migrateTerminalVisibility(
  terminalVisibleBySession: Record<string, boolean>,
  fromConversationId: string | null,
  toConversationId: string,
) {
  if (!fromConversationId || fromConversationId === toConversationId)
    return terminalVisibleBySession
  if (!isLocalConversationId(fromConversationId) || isLocalConversationId(toConversationId)) {
    return terminalVisibleBySession
  }
  if (Object.hasOwn(terminalVisibleBySession, toConversationId)) return terminalVisibleBySession
  if (!Object.hasOwn(terminalVisibleBySession, fromConversationId)) return terminalVisibleBySession

  return {
    ...terminalVisibleBySession,
    [toConversationId]: terminalVisibleBySession[fromConversationId] ?? false,
  }
}

export function shouldRestoreTerminalOnGitOpsClose(state: WorkspaceState) {
  return state.terminalVisible && (state.activeView === 'thread' || state.activeView === 'project')
}

export function shouldMigrateTerminalVisibilityForOpenedThread(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
) {
  if (
    state.activeView === 'project' &&
    state.selectedProjectId === action.projectId &&
    (state.workspaceTerminalVisibleByWorkspace[action.projectId] ?? false)
  ) {
    return true
  }

  if (
    state.activeView !== 'thread' ||
    !state.selectedConversationId ||
    state.selectedConversationId === action.conversationId
  ) {
    return false
  }

  if (state.selectedThreadId === action.threadId) {
    return !Object.hasOwn(state.terminalVisibleBySession, action.conversationId)
  }

  return false
}

export function getTerminalStateForNextView(state: WorkspaceState, nextView: View) {
  const getWorkspaceTerminalVisible = () => {
    if (state.selectedConversationId) {
      return getTerminalVisibilityForSession(
        state.terminalVisibleBySession,
        state.selectedConversationId,
      )
    }
    return state.selectedProjectId
      ? (state.workspaceTerminalVisibleByWorkspace[state.selectedProjectId] ?? false)
      : false
  }

  if (state.activeView !== 'gitops') {
    return {
      terminalVisible:
        nextView === 'thread'
          ? getTerminalVisibilityForSession(
              state.terminalVisibleBySession,
              state.selectedConversationId,
            )
          : nextView === 'project'
            ? getWorkspaceTerminalVisible()
            : state.terminalVisible,
      restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    }
  }

  if (nextView === 'gitops') {
    return {
      terminalVisible: false,
      restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    }
  }

  return {
    terminalVisible:
      (nextView === 'thread' || nextView === 'project') &&
      state.restoreTerminalVisibleOnGitOpsClose,
    restoreTerminalVisibleOnGitOpsClose: false,
  }
}

export function setTerminalVisibleState(state: WorkspaceState, visible: boolean): WorkspaceState {
  if (!state.selectedConversationId) {
    if (!state.selectedProjectId) return { ...state, terminalVisible: visible }
    return {
      ...state,
      terminalVisible: visible,
      workspaceTerminalVisibleByWorkspace: {
        ...state.workspaceTerminalVisibleByWorkspace,
        [state.selectedProjectId]: visible,
      },
    }
  }
  return {
    ...state,
    terminalVisible: visible,
    terminalVisibleBySession: {
      ...state.terminalVisibleBySession,
      [state.selectedConversationId]: visible,
    },
  }
}

export function createInitialTerminalWorkspaceState() {
  return {
    terminalVisible: false,
    workspaceTerminalVisibleByWorkspace: {},
    terminalVisibleBySession: {},
    restoreTerminalVisibleOnGitOpsClose: false,
  }
}

export function getTerminalUtilityReturnState(state: WorkspaceState) {
  return {
    terminalVisible: state.terminalVisible,
    workspaceTerminalVisibleByWorkspace: state.workspaceTerminalVisibleByWorkspace,
    restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
  }
}

export function getTerminalStateForOpenedThread(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
) {
  const nextTerminalVisibleBySession = shouldMigrateTerminalVisibilityForOpenedThread(state, action)
    ? {
        ...state.terminalVisibleBySession,
        [action.conversationId]:
          state.activeView === 'project'
            ? (state.workspaceTerminalVisibleByWorkspace[action.projectId] ?? false)
            : getTerminalVisibilityForSession(
                state.terminalVisibleBySession,
                state.selectedConversationId,
              ),
      }
    : state.terminalVisibleBySession
  return {
    terminalVisible: getTerminalVisibilityForSession(
      nextTerminalVisibleBySession,
      action.conversationId,
    ),
    terminalVisibleBySession: nextTerminalVisibleBySession,
  }
}
