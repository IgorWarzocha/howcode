import {
  clearCodingThreadSelection,
  createCodingWorkspaceTransitions,
  getCodingStateForOpenedThread,
  getCodingStateForPreviewedThread,
  getCodingStateForShownView,
  getCodingUtilityReturnState,
} from '@howcode/plugins/coding/ui'
import {
  getTerminalStateForNextView,
  getTerminalStateForOpenedThread,
  getTerminalUtilityReturnState,
  getTerminalVisibilityForSession,
  migrateTerminalVisibility,
  setTerminalVisibleState,
  shouldRestoreTerminalOnGitOpsClose,
} from '@howcode/plugins/terminal/ui'
import { isWorkspaceUtilityView } from '../extensions/toolkit-plugins'
import type { View } from '../types'
import type {
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

const { codingWorkspaceActionHandlers, restoreCodeThreadForView } =
  createCodingWorkspaceTransitions({
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
    shouldRestoreTerminalOnGitOpsClose,
  })

export function isUtilityView(view: View): view is UtilityView {
  return isWorkspaceUtilityView(view)
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
    ...getTerminalUtilityReturnState(state),
    ...getCodingUtilityReturnState(state),
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  const restoredCodeThread = restoreCodeThreadForView(state, action.view)
  if (restoredCodeThread) return restoredCodeThread

  const utilityViewReturnState = isUtilityView(action.view)
    ? isUtilityView(state.activeView)
      ? state.utilityViewReturnState
      : createUtilityViewReturnState(state)
    : null
  return {
    ...state,
    ...getTerminalStateForNextView(state, action.view),
    activeView: action.view,
    settingsOpen: false,
    settingsPanelOpen: false,
    ...getCodingStateForShownView(state, action.view),
    selectedThreadId:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedThreadId
        : null,
    selectedConversationId:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedConversationId
        : null,
    utilityViewReturnState,
  }
}

function openThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
): WorkspaceState {
  const activeView = action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread')
  return {
    ...state,
    activeView,
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: action.threadId,
    selectedConversationId: action.conversationId,
    ...getTerminalStateForOpenedThread(state, action),
    utilityViewReturnState: null,
    ...getCodingStateForOpenedThread(state, action, activeView),
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
    utilityViewReturnState: null,
    ...getCodingStateForPreviewedThread(state, action),
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
    ...clearCodingThreadSelection(),
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
