import {
  getTerminalStateForNextView,
  getTerminalStateForOpenedChat,
  getTerminalUtilityReturnState,
  getTerminalVisibilityForSession,
  migrateTerminalVisibility,
  setTerminalVisibleState,
} from '@howcode/components/terminal/ui'
import {
  clearDirectoryChatSelection,
  createDirectoryWorkspaceTransitions,
  getDirectoryStateForOpenedChat,
  getDirectoryStateForPreviewedChat,
  getDirectoryStateForShownView,
  getDirectoryUtilityReturnState,
} from '@howcode/components/working-directories/ui'
import { createGitWorkspaceTransitions } from '@howcode/git-integration'
import { isWorkspaceUtilityView } from '../component-system/toolkit-components'
import type { View } from '../types'
import type {
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

const { directoryWorkspaceActionHandlers, restoreCodeChatForView } =
  createDirectoryWorkspaceTransitions({
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
  })

const gitWorkspaceActionHandlers = createGitWorkspaceTransitions()

export function isUtilityView(view: View): view is UtilityView {
  return isWorkspaceUtilityView(view)
}

function createUtilityViewReturnState(state: WorkspaceState): UtilityViewReturnState {
  return {
    activeView: state.activeView,
    selectedWorkspaceId: state.selectedWorkspaceId,
    composerProfile: state.composerProfile,
    selectedDirectoryId: state.selectedDirectoryId,
    hasSelectedDirectory: state.hasSelectedDirectory,
    landingVisible: state.landingVisible,
    selectedInboxConversationId: state.selectedInboxConversationId,
    selectedChatId: state.selectedChatId,
    selectedConversationId: state.selectedConversationId,
    ...getTerminalUtilityReturnState(state),
    ...getDirectoryUtilityReturnState(state),
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  const restoredCodeChat = restoreCodeChatForView(state, action.view)
  if (restoredCodeChat) return restoredCodeChat

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
    ...getDirectoryStateForShownView(state, action.view),
    selectedChatId: action.view === 'chat' ? state.selectedChatId : null,
    selectedConversationId: action.view === 'chat' ? state.selectedConversationId : null,
    utilityViewReturnState,
  }
}

function openChatState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-chat' }>,
): WorkspaceState {
  const activeView = 'chat'
  return {
    ...state,
    activeView,
    selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
    composerProfile: action.composerProfile ?? state.composerProfile,
    selectedDirectoryId: action.directoryId,
    hasSelectedDirectory: true,
    landingVisible: false,
    selectedChatId: action.chatId,
    selectedConversationId: action.conversationId,
    ...getTerminalStateForOpenedChat(state, action),
    utilityViewReturnState: null,
    ...getDirectoryStateForOpenedChat(state, action),
  }
}

function previewChatState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-chat' }>,
): WorkspaceState {
  return {
    ...state,
    activeView: 'chat',
    selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
    composerProfile: action.composerProfile ?? state.composerProfile,
    selectedDirectoryId: action.directoryId,
    hasSelectedDirectory: true,
    landingVisible: false,
    selectedChatId: action.chatId,
    utilityViewReturnState: null,
    ...getDirectoryStateForPreviewedChat(state, action),
  }
}

export const workspaceActionHandlers = {
  ...directoryWorkspaceActionHandlers,
  ...gitWorkspaceActionHandlers,
  'select-workspace': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-workspace' }>,
  ): WorkspaceState => ({
    ...state,
    activeView: 'workspace',
    selectedWorkspaceId: action.workspaceId,
    selectedDirectoryId: action.directoryId ?? '',
    hasSelectedDirectory: Boolean(action.directoryId),
    composerProfile: action.directoryId ? 'coding' : 'general',
    selectedChatId: null,
    selectedConversationId: null,
    selectedDiffFilePath: null,
    landingVisible: false,
    utilityViewReturnState: null,
    terminalVisible: false,
  }),
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
  'clear-chat-selection': (state: WorkspaceState) => ({
    ...state,
    selectedChatId: null,
    selectedConversationId: null,
    ...clearDirectoryChatSelection(),
  }),
  'select-inbox-chat': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-inbox-chat' }>,
  ) => ({ ...state, selectedInboxConversationId: action.conversationId }),
  'preview-chat': previewChatState,
  'open-chat': openChatState,
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
