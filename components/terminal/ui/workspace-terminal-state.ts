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
  return state.terminalVisible && (state.activeView === 'chat' || state.activeView === 'directory')
}

export function shouldMigrateTerminalVisibilityForOpenedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-chat' }>,
) {
  if (
    state.activeView === 'directory' &&
    state.selectedDirectoryId === action.directoryId &&
    (state.workspaceTerminalVisibleByWorkspace[action.directoryId] ?? false)
  ) {
    return true
  }

  if (
    state.activeView !== 'chat' ||
    !state.selectedConversationId ||
    state.selectedConversationId === action.conversationId
  ) {
    return false
  }

  if (state.selectedChatId === action.chatId) {
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
    return state.selectedDirectoryId
      ? (state.workspaceTerminalVisibleByWorkspace[state.selectedDirectoryId] ?? false)
      : false
  }

  if (state.activeView !== 'gitops') {
    return {
      terminalVisible:
        nextView === 'chat'
          ? getTerminalVisibilityForSession(
              state.terminalVisibleBySession,
              state.selectedConversationId,
            )
          : nextView === 'directory'
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
      (nextView === 'chat' || nextView === 'directory') &&
      state.restoreTerminalVisibleOnGitOpsClose,
    restoreTerminalVisibleOnGitOpsClose: false,
  }
}

export function setTerminalVisibleState(state: WorkspaceState, visible: boolean): WorkspaceState {
  if (!state.selectedConversationId) {
    if (!state.selectedDirectoryId) return { ...state, terminalVisible: visible }
    return {
      ...state,
      terminalVisible: visible,
      workspaceTerminalVisibleByWorkspace: {
        ...state.workspaceTerminalVisibleByWorkspace,
        [state.selectedDirectoryId]: visible,
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

export function getTerminalStateForOpenedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-chat' }>,
) {
  const nextTerminalVisibleBySession = shouldMigrateTerminalVisibilityForOpenedChat(state, action)
    ? {
        ...state.terminalVisibleBySession,
        [action.conversationId]:
          state.activeView === 'directory'
            ? (state.workspaceTerminalVisibleByWorkspace[action.directoryId] ?? false)
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
