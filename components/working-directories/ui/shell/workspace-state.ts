import type {
  ChatSelection,
  WorkspaceAction,
  WorkspaceState,
} from '../../../../src/app/state/workspace-model'
import type { View, WorkingDirectory } from '../../../../src/app/types'

export function getCurrentChatSelection(state: WorkspaceState): ChatSelection | null {
  if (
    (state.activeView === 'chat' || state.activeView === 'directory') &&
    state.selectedDirectoryId &&
    state.selectedChatId &&
    state.selectedConversationId
  ) {
    return {
      directoryId: state.selectedDirectoryId,
      chatId: state.selectedChatId,
      conversationId: state.selectedConversationId,
    }
  }

  return state.lastChatSelection
}

function getScopedChatSelection(state: WorkspaceState, directoryId: string): ChatSelection | null {
  return state.lastChatSelection?.directoryId === directoryId ? state.lastChatSelection : null
}

function isDirectoryLoadedForChats(directory: WorkingDirectory) {
  return directory.chatsLoaded === true
}

function getDirectoryChatSelection(
  directory: WorkingDirectory,
  chat: WorkingDirectory['chats'][number],
  fallbackConversationId: string,
): ChatSelection {
  return {
    directoryId: directory.id,
    chatId: chat.id,
    conversationId: chat.conversationId ?? fallbackConversationId,
  }
}

export function resolveChatSelection(
  directories: WorkingDirectory[],
  selection: ChatSelection | null,
): ChatSelection | null {
  if (!selection) return null

  for (const directory of directories) {
    if (!isDirectoryLoadedForChats(directory)) continue
    const chat = directory.chats.find(
      (candidate) => candidate.conversationId === selection.conversationId,
    )
    if (chat) return getDirectoryChatSelection(directory, chat, selection.conversationId)
  }

  for (const directory of directories) {
    if (!isDirectoryLoadedForChats(directory)) continue
    const chat = directory.chats.find((candidate) => candidate.id === selection.chatId)
    if (chat) return getDirectoryChatSelection(directory, chat, selection.conversationId)
  }

  // Directory lists are not conversation inventory. Chats may use unregistered cwds.
  return selection
}

function findDirectoryContainingChat(directories: WorkingDirectory[], state: WorkspaceState) {
  if (state.selectedConversationId) {
    return (
      directories.find((directory) =>
        directory.chats.some((chat) => chat.conversationId === state.selectedConversationId),
      ) ?? null
    )
  }

  if (!state.selectedChatId) {
    return null
  }

  return (
    directories.find((directory) =>
      directory.chats.some((chat) => chat.id === state.selectedChatId),
    ) ?? null
  )
}

function getSyncedActiveView(input: {
  actionDirectoriesLength: number
  hasSelectedDirectory: boolean
  selectedDirectoryId: string
  shouldPreserveSelectedChat: boolean
  activeView: View
}) {
  if (input.shouldPreserveSelectedChat) return input.activeView
  if (input.activeView === 'directory' && !input.hasSelectedDirectory) return 'directories'
  if (
    input.hasSelectedDirectory ||
    !input.selectedDirectoryId ||
    input.actionDirectoriesLength === 0
  )
    return input.activeView
  return 'directories'
}

function getPreservedChatValue<T>(
  state: WorkspaceState,
  shouldPreserveDirectorySelection: boolean,
  value: T,
) {
  return shouldPreserveDirectorySelection || !state.selectedDirectoryId ? value : null
}

export type TerminalWorkspaceTransitions = {
  getTerminalStateForNextView: (
    state: WorkspaceState,
    view: View,
  ) => Pick<WorkspaceState, 'terminalVisible'>
  getTerminalVisibilityForSession: (
    visibility: Record<string, boolean>,
    conversationId: string | null,
  ) => boolean
  migrateTerminalVisibility: (
    visibility: Record<string, boolean>,
    fromConversationId: string | null,
    toConversationId: string,
  ) => Record<string, boolean>
}

export function createDirectoryWorkspaceTransitions(terminal: TerminalWorkspaceTransitions) {
  const {
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
  } = terminal
  function withChatSelection(state: WorkspaceState, selection: ChatSelection): WorkspaceState {
    return {
      ...state,
      activeView: 'chat',
      selectedDirectoryId: selection.directoryId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: selection.chatId,
      selectedConversationId: selection.conversationId,
      composerExtensions: null,
      terminalVisible: getTerminalVisibilityForSession(
        state.terminalVisibleBySession,
        selection.conversationId,
      ),
      selectedDiffFilePath: null,

      utilityViewReturnState: null,
      collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [selection.directoryId]: false },
      lastChatSelection: selection,
    }
  }

  function syncDirectoriesState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'sync-directories' }>,
  ): WorkspaceState {
    const lastChatSelection = resolveChatSelection(action.directories, state.lastChatSelection)
    const hasSelectedDirectory = action.directories.some(
      (directory) => directory.id === state.selectedDirectoryId,
    )
    const selectedChatDirectory = findDirectoryContainingChat(action.directories, state)
    const shouldPreserveSelectedChat = Boolean(state.selectedConversationId)
    const shouldPreserveDirectorySelection = hasSelectedDirectory || shouldPreserveSelectedChat
    const nextHasSelectedDirectory = Boolean(selectedChatDirectory) || hasSelectedDirectory
    const collapsedDirectoryIds = Object.fromEntries(
      action.directories.map((directory) => [
        directory.id,
        state.collapsedDirectoryIds[directory.id] ?? directory.collapsed ?? true,
      ]),
    )
    const nextActiveView = getSyncedActiveView({
      actionDirectoriesLength: action.directories.length,
      activeView: state.activeView,
      hasSelectedDirectory,
      selectedDirectoryId: state.selectedDirectoryId,
      shouldPreserveSelectedChat,
    })
    return {
      ...state,
      ...getTerminalStateForNextView(state, nextActiveView),
      activeView: nextActiveView,
      selectedDirectoryId:
        selectedChatDirectory?.id ??
        (shouldPreserveDirectorySelection ? state.selectedDirectoryId : ''),
      hasSelectedDirectory:
        nextHasSelectedDirectory &&
        (state.hasSelectedDirectory || shouldPreserveDirectorySelection),
      landingVisible:
        state.landingVisible && !selectedChatDirectory && !state.hasSelectedDirectory
          ? true
          : state.landingVisible && shouldPreserveDirectorySelection,
      selectedChatId: getPreservedChatValue(
        state,
        shouldPreserveDirectorySelection,
        state.selectedChatId,
      ),
      selectedConversationId: getPreservedChatValue(
        state,
        shouldPreserveDirectorySelection,
        state.selectedConversationId,
      ),
      selectedDiffFilePath: getPreservedChatValue(
        state,
        shouldPreserveDirectorySelection,
        state.selectedDiffFilePath,
      ),
      utilityViewReturnState: getPreservedChatValue(
        state,
        shouldPreserveDirectorySelection,
        state.utilityViewReturnState,
      ),
      lastChatSelection,
      collapsedDirectoryIds,
    }
  }

  function startDirectoryChatState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'start-directory-chat' }>,
  ): WorkspaceState {
    const nextTerminalVisibleBySession = migrateTerminalVisibility(
      state.terminalVisibleBySession,
      state.selectedConversationId,
      action.conversationId,
    )
    return {
      ...state,
      ...getTerminalStateForNextView(state, 'directory'),
      activeView: 'directory',
      selectedDirectoryId: action.directoryId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: action.chatId,
      selectedConversationId: action.conversationId,
      composerExtensions: null,
      terminalVisible: getTerminalVisibilityForSession(
        nextTerminalVisibleBySession,
        action.conversationId,
      ),
      terminalVisibleBySession: nextTerminalVisibleBySession,
      selectedDiffFilePath: null,

      utilityViewReturnState: null,
      collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [action.directoryId]: false },
      lastChatSelection: {
        directoryId: action.directoryId,
        chatId: action.chatId,
        conversationId: action.conversationId,
      },
    }
  }

  const directoryWorkspaceActionHandlers = {
    'sync-directories': syncDirectoriesState,
    'show-landing': (state: WorkspaceState) => ({
      ...state,
      activeView: 'landing',
      terminalVisible: false,
      selectedDirectoryId: '',
      selectedInboxConversationId: null,
      selectedChatId: null,
      selectedConversationId: null,
      composerExtensions: null,
      selectedDiffFilePath: null,
      lastChatSelection: null,
      settingsPanelOpen: false,

      utilityViewReturnState: null,
      hasSelectedDirectory: false,
      landingVisible: true,
    }),
    'select-directory': (
      state: WorkspaceState,
      action: Extract<WorkspaceAction, { type: 'select-directory' }>,
    ) => ({
      ...state,
      ...getTerminalStateForNextView(state, 'directory'),
      activeView: 'directory',
      selectedDirectoryId: action.directoryId,
      selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: null,
      selectedConversationId: null,
      composerExtensions: null,
      terminalVisible: state.workspaceTerminalVisibleByWorkspace[action.directoryId] ?? false,
      selectedDiffFilePath: null,

      utilityViewReturnState: null,
      lastChatSelection: getScopedChatSelection(state, action.directoryId),
    }),
    'set-selected-directory': (
      state: WorkspaceState,
      action: Extract<WorkspaceAction, { type: 'set-selected-directory' }>,
    ) => ({
      ...state,
      selectedDirectoryId: action.directoryId,
      selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
      hasSelectedDirectory: true,
      landingVisible: false,
      lastChatSelection: getScopedChatSelection(state, action.directoryId),
    }),
    'start-directory-chat': startDirectoryChatState,
    'toggle-directory-collapse': (
      state: WorkspaceState,
      action: Extract<WorkspaceAction, { type: 'toggle-directory-collapse' }>,
    ) => ({
      ...state,
      collapsedDirectoryIds: {
        ...state.collapsedDirectoryIds,
        [action.directoryId]: !state.collapsedDirectoryIds[action.directoryId],
      },
    }),
    'collapse-all-directories': (state: WorkspaceState) => ({
      ...state,
      collapsedDirectoryIds: Object.fromEntries(
        Object.keys(state.collapsedDirectoryIds).map((directoryId) => [directoryId, true]),
      ),
    }),
  } satisfies Partial<{
    [Action in WorkspaceAction as Action['type']]: (
      state: WorkspaceState,
      action: Action,
    ) => WorkspaceState
  }>

  function restoreChatForView(state: WorkspaceState, view: View): WorkspaceState | null {
    const selection = getCurrentChatSelection(state)
    return view === 'directories' && selection ? withChatSelection(state, selection) : null
  }

  return { directoryWorkspaceActionHandlers, withChatSelection, restoreChatForView }
}

export function createInitialDirectoryWorkspaceState(
  directories: WorkingDirectory[],
): Pick<WorkspaceState, 'selectedDiffFilePath' | 'collapsedDirectoryIds' | 'lastChatSelection'> {
  return {
    selectedDiffFilePath: null,
    collapsedDirectoryIds: Object.fromEntries(
      directories.map((directory) => [directory.id, directory.collapsed ?? true]),
    ),
    lastChatSelection: null,
  }
}

export function getDirectoryUtilityReturnState(state: WorkspaceState) {
  return {
    selectedDiffFilePath: state.selectedDiffFilePath,
  }
}

export function getDirectoryStateForShownView(state: WorkspaceState, view: View) {
  return {
    landingVisible: view === 'directories' ? state.landingVisible : false,
    lastChatSelection: getCurrentChatSelection(state),
    selectedDiffFilePath: view === 'chat' ? state.selectedDiffFilePath : null,
  }
}

export function clearDirectoryChatSelection() {
  return { selectedDiffFilePath: null, lastChatSelection: null }
}

export function getDirectoryStateForPreviewedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-chat' | 'open-chat' }>,
): Pick<WorkspaceState, 'selectedDiffFilePath' | 'collapsedDirectoryIds'> {
  return {
    selectedDiffFilePath: null,

    collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [action.directoryId]: false },
  }
}

export function getDirectoryStateForOpenedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-chat' }>,
) {
  return {
    ...getDirectoryStateForPreviewedChat(state, action),
    lastChatSelection: {
      directoryId: action.directoryId,
      chatId: action.chatId,
      conversationId: action.conversationId,
    },
  }
}
