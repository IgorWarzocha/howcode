import {
  createCodingWorkspaceTransitions,
  getCurrentCodeThreadSelection,
} from '@howcode/plugins/coding/ui'
import {
  getTerminalStateForNextView,
  getTerminalVisibilityForSession,
  migrateTerminalVisibility,
  setTerminalVisibleState,
  shouldMigrateTerminalVisibilityForOpenedThread,
  shouldRestoreTerminalOnGitOpsClose,
} from '@howcode/plugins/terminal/ui'
import type { View } from '../types'
import type {
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

const { codingWorkspaceActionHandlers, withCodeThreadSelection } = createCodingWorkspaceTransitions(
  {
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
    shouldRestoreTerminalOnGitOpsClose,
  },
)

export function isUtilityView(view: View): view is UtilityView {
  return view === 'settings' || view === 'skills' || view === 'sessions'
}

function createUtilityViewReturnState(state: WorkspaceState): UtilityViewReturnState {
  return {
    activeView: state.activeView,
    selectedProjectId: state.selectedProjectId,
    hasSelectedProject: state.hasSelectedProject,
    landingVisible: state.landingVisible,
    selectedInboxConversationId: state.selectedInboxConversationId,
    selectedThreadId: state.selectedThreadId,
    selectedConversationId: state.selectedConversationId,
    terminalVisible: state.terminalVisible,
    workspaceTerminalVisibleByWorkspace: state.workspaceTerminalVisibleByWorkspace,
    restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    gitOpsReturnView: state.gitOpsReturnView,
    selectedDiffFilePath: state.selectedDiffFilePath,
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  const lastCodeThreadSelection = getCurrentCodeThreadSelection(state)
  if (action.view === 'code' && lastCodeThreadSelection) {
    return withCodeThreadSelection(state, lastCodeThreadSelection)
  }

  const utilityViewReturnState = isUtilityView(action.view)
    ? isUtilityView(state.activeView)
      ? state.utilityViewReturnState
      : createUtilityViewReturnState(state)
    : null
  return {
    ...state,
    ...getTerminalStateForNextView(state, action.view),
    activeView: action.view,
    landingVisible: action.view === 'code' ? state.landingVisible : false,
    settingsOpen: false,
    settingsPanelOpen: false,
    lastCodeThreadSelection,
    selectedThreadId:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedThreadId
        : null,
    selectedConversationId:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedConversationId
        : null,
    selectedDiffFilePath: action.view === 'thread' ? state.selectedDiffFilePath : null,
    utilityViewReturnState,
  }
}

function openThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
): WorkspaceState {
  const activeView = action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread')
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
    ...state,
    activeView,
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: action.threadId,
    selectedConversationId: action.conversationId,
    terminalVisible: getTerminalVisibilityForSession(
      nextTerminalVisibleBySession,
      action.conversationId,
    ),
    terminalVisibleBySession: nextTerminalVisibleBySession,
    selectedDiffFilePath: null,
    gitOpsReturnView: 'thread',
    utilityViewReturnState: null,
    collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
    lastCodeThreadSelection:
      activeView === 'chat'
        ? state.lastCodeThreadSelection
        : {
            projectId: action.projectId,
            threadId: action.threadId,
            conversationId: action.conversationId,
          },
  }
}

function previewThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-thread' }>,
): WorkspaceState {
  return {
    ...state,
    activeView: action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread'),
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: action.threadId,
    selectedDiffFilePath: null,
    gitOpsReturnView: 'thread',
    utilityViewReturnState: null,
    collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
  }
}

export const workspaceActionHandlers = {
  ...codingWorkspaceActionHandlers,
  'show-view': showViewState,
  'close-utility-view': (state: WorkspaceState) =>
    state.utilityViewReturnState
      ? {
          ...state,
          ...state.utilityViewReturnState,
          settingsOpen: false,
          settingsPanelOpen: false,
          utilityViewReturnState: null,
        }
      : state,
  'clear-thread-selection': (state: WorkspaceState) => ({
    ...state,
    selectedThreadId: null,
    selectedConversationId: null,
    selectedDiffFilePath: null,
    lastCodeThreadSelection: null,
  }),
  'select-inbox-thread': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-inbox-thread' }>,
  ) => ({ ...state, selectedInboxConversationId: action.conversationId }),
  'preview-thread': previewThreadState,
  'open-thread': openThreadState,
  'toggle-terminal': (state: WorkspaceState) =>
    setTerminalVisibleState(state, !state.terminalVisible),
  'set-terminal-visible': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-terminal-visible' }>,
  ) => setTerminalVisibleState(state, action.visible),
  'toggle-settings': (state: WorkspaceState) => ({ ...state, settingsOpen: !state.settingsOpen }),
  'set-settings-panel-open': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-settings-panel-open' }>,
  ) => ({
    ...state,
    settingsPanelOpen: action.open,
    settingsOpen: action.open ? false : state.settingsOpen,
  }),
} satisfies {
  [Action in WorkspaceAction as Action['type']]: (
    state: WorkspaceState,
    action: Action,
  ) => WorkspaceState
}
