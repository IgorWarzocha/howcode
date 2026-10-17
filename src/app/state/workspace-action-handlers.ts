import {
  getTerminalStateForNextView,
  getTerminalStateForOpenedChat,
  getTerminalUtilityReturnState,
  getTerminalVisibilityForSession,
  migrateTerminalVisibility,
  setTerminalVisibleState,
} from '@howaboua/howcode-sdk/terminal-state'
import {
  clearDirectoryChatSelection,
  createDirectoryWorkspaceTransitions,
  getDirectoryStateForOpenedChat,
  getDirectoryStateForPreviewedChat,
  getDirectoryStateForShownView,
  getDirectoryUtilityReturnState,
} from '@howcode/components/working-directories/ui'
import { isWorkspaceUtilityView } from '../component-system/toolkit-components'
import { getGitRendererApi } from '../git-integration/client'
import type { View } from '../types'
import type {
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

const { directoryWorkspaceActionHandlers, restoreChatForView } =
  createDirectoryWorkspaceTransitions({
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
  })

export function isUtilityView(view: View): view is UtilityView {
  return isWorkspaceUtilityView(view)
}

function createUtilityViewReturnState(state: WorkspaceState): UtilityViewReturnState {
  return {
    utilityViewReturnState: state.utilityViewReturnState,
    activeView: state.activeView,
    selectedWorkspaceId: state.selectedWorkspaceId,
    selectedDirectoryId: state.selectedDirectoryId,
    hasSelectedDirectory: state.hasSelectedDirectory,
    landingVisible: state.landingVisible,
    selectedInboxConversationId: state.selectedInboxConversationId,
    selectedChatId: state.selectedChatId,
    selectedConversationId: state.selectedConversationId,
    composerExtensions: state.composerExtensions,
    ...getTerminalUtilityReturnState(state),
    ...getDirectoryUtilityReturnState(state),
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  // Component pages retain the active work selection; page navigation is not a chat reset.
  if (action.view.startsWith('component:'))
    return {
      ...state,
      activeView: action.view,
      utilityViewReturnState: state.activeView.startsWith('component:')
        ? state.utilityViewReturnState
        : createUtilityViewReturnState(state),
      settingsPanelOpen: false,
    }

  const restoredChat = restoreChatForView(state, action.view)
  if (restoredChat) return restoredChat

  const utilityViewReturnState = isUtilityView(action.view)
    ? isUtilityView(state.activeView)
      ? state.utilityViewReturnState
      : createUtilityViewReturnState(state)
    : null
  return {
    ...state,
    ...getTerminalStateForNextView(state, action.view),
    activeView: action.view,
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
    selectedDirectoryId: action.directoryId,
    hasSelectedDirectory: true,
    landingVisible: false,
    selectedChatId: action.chatId,
    selectedConversationId: action.conversationId,
    composerExtensions:
      action.composerExtensions ??
      (state.selectedConversationId === action.conversationId ? state.composerExtensions : null),
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
    composerExtensions: null,
    selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
    selectedDirectoryId: action.directoryId,
    hasSelectedDirectory: true,
    landingVisible: false,
    selectedChatId: action.chatId,
    utilityViewReturnState: null,
    ...getDirectoryStateForPreviewedChat(state, action),
  }
}

export const workspaceActionHandlers = {
  'set-composer-extensions': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-composer-extensions' }>,
  ) =>
    state.selectedConversationId === action.conversationId &&
    state.selectedDirectoryId === action.directoryId &&
    state.selectedWorkspaceId === action.workspaceId
      ? { ...state, composerExtensions: action.extensions }
      : state,
  ...directoryWorkspaceActionHandlers,
  'open-gitops': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'open-gitops' }>,
  ) =>
    getGitRendererApi()
      ?.createGitWorkspaceTransitions<WorkspaceState>()
      ['open-gitops'](state, action) ?? state,
  'close-gitops': (state: WorkspaceState) =>
    getGitRendererApi()?.createGitWorkspaceTransitions<WorkspaceState>()['close-gitops'](state) ??
    state,
  'select-workspace': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-workspace' }>,
  ): WorkspaceState => ({
    ...state,
    activeView: 'workspace',
    selectedWorkspaceId: action.workspaceId,
    selectedDirectoryId: action.directoryId ?? '',
    hasSelectedDirectory: Boolean(action.directoryId),
    selectedChatId: null,
    selectedConversationId: null,
    composerExtensions: null,
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
          settingsPanelOpen: false,
          utilityViewReturnState: state.utilityViewReturnState.utilityViewReturnState,
        }
      : state,
  'clear-chat-selection': (state: WorkspaceState) => ({
    ...state,
    selectedChatId: null,
    selectedConversationId: null,
    composerExtensions: null,
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
  'set-settings-panel-open': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-settings-panel-open' }>,
  ) => ({
    ...state,
    settingsPanelOpen: action.open,
  }),
} satisfies {
  [Action in WorkspaceAction as Action['type']]: (
    state: WorkspaceState,
    action: Action,
  ) => WorkspaceState
}
