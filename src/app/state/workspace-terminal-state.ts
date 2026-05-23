import { isLocalSessionPath } from '@howcode/shared/session-paths'
import type { View } from '../types'
import type { NonGitOpsView, WorkspaceAction, WorkspaceState } from './workspace'

export function migrateTakeoverOverride(
  takeoverOverrides: Record<string, boolean>,
  fromSessionPath: string | null,
  toSessionPath: string,
) {
  if (!fromSessionPath || fromSessionPath === toSessionPath) return takeoverOverrides
  if (!isLocalSessionPath(fromSessionPath) || isLocalSessionPath(toSessionPath)) {
    return takeoverOverrides
  }
  if (!Object.hasOwn(takeoverOverrides, fromSessionPath)) return takeoverOverrides

  const { [fromSessionPath]: override, ...remainingOverrides } = takeoverOverrides
  return { ...remainingOverrides, [toSessionPath]: override ?? false }
}

export function getGitOpsReturnView(activeView: View, fallback: NonGitOpsView): NonGitOpsView {
  return activeView === 'gitops' ? fallback : activeView
}

export function getTerminalVisibilityForSession(
  terminalVisibleBySession: Record<string, boolean>,
  sessionPath: string | null,
) {
  return sessionPath ? (terminalVisibleBySession[sessionPath] ?? false) : false
}

export function migrateTerminalVisibility(
  terminalVisibleBySession: Record<string, boolean>,
  fromSessionPath: string | null,
  toSessionPath: string,
) {
  if (!fromSessionPath || fromSessionPath === toSessionPath) return terminalVisibleBySession
  if (!isLocalSessionPath(fromSessionPath) || isLocalSessionPath(toSessionPath)) {
    return terminalVisibleBySession
  }
  if (Object.hasOwn(terminalVisibleBySession, toSessionPath)) return terminalVisibleBySession
  if (!Object.hasOwn(terminalVisibleBySession, fromSessionPath)) return terminalVisibleBySession

  return {
    ...terminalVisibleBySession,
    [toSessionPath]: terminalVisibleBySession[fromSessionPath] ?? false,
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
    (state.projectTerminalVisibleByProject[action.projectId] ?? false)
  ) {
    return true
  }

  if (
    state.activeView !== 'thread' ||
    !state.selectedSessionPath ||
    state.selectedSessionPath === action.sessionPath
  ) {
    return false
  }

  if (state.selectedThreadId === action.threadId) {
    return !Object.hasOwn(state.terminalVisibleBySession, action.sessionPath)
  }

  return false
}

export function getTerminalStateForNextView(state: WorkspaceState, nextView: View) {
  const getProjectTerminalVisible = () => {
    if (state.selectedSessionPath) {
      return getTerminalVisibilityForSession(
        state.terminalVisibleBySession,
        state.selectedSessionPath,
      )
    }
    return state.selectedProjectId
      ? (state.projectTerminalVisibleByProject[state.selectedProjectId] ?? false)
      : false
  }

  if (state.activeView !== 'gitops') {
    return {
      terminalVisible:
        nextView === 'thread'
          ? getTerminalVisibilityForSession(
              state.terminalVisibleBySession,
              state.selectedSessionPath,
            )
          : nextView === 'project'
            ? getProjectTerminalVisible()
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
  if (!state.selectedSessionPath) {
    if (!state.selectedProjectId) return { ...state, terminalVisible: visible }
    return {
      ...state,
      terminalVisible: visible,
      projectTerminalVisibleByProject: {
        ...state.projectTerminalVisibleByProject,
        [state.selectedProjectId]: visible,
      },
    }
  }
  return {
    ...state,
    terminalVisible: visible,
    terminalVisibleBySession: {
      ...state.terminalVisibleBySession,
      [state.selectedSessionPath]: visible,
    },
  }
}
