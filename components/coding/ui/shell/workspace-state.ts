import type {
  CodeChatSelection,
  WorkspaceAction,
  WorkspaceState,
} from '../../../../src/app/state/workspace-model'
import type { View, WorkingDirectory } from '../../../../src/app/types'

export function getCurrentCodeChatSelection(state: WorkspaceState): CodeChatSelection | null {
  if (
    ((state.activeView === 'chat' && state.composerProfile === 'coding') ||
      state.activeView === 'directory') &&
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

  return state.lastCodeChatSelection
}

function getScopedCodeChatSelection(
  state: WorkspaceState,
  directoryId: string,
): CodeChatSelection | null {
  return state.lastCodeChatSelection?.directoryId === directoryId
    ? state.lastCodeChatSelection
    : null
}

function isDirectoryLoadedForCodeChats(directory: WorkingDirectory) {
  return directory.chatsLoaded === true
}

function getChatCodeSelection(
  directory: WorkingDirectory,
  chat: WorkingDirectory['chats'][number],
  fallbackConversationId: string,
): CodeChatSelection {
  return {
    directoryId: directory.id,
    chatId: chat.id,
    conversationId: chat.conversationId ?? fallbackConversationId,
  }
}

export function resolveCodeChatSelection(
  directories: WorkingDirectory[],
  selection: CodeChatSelection | null,
): CodeChatSelection | null {
  if (!selection) return null

  for (const directory of directories) {
    if (!isDirectoryLoadedForCodeChats(directory)) continue
    const chat = directory.chats.find(
      (candidate) => candidate.conversationId === selection.conversationId,
    )
    if (chat) return getChatCodeSelection(directory, chat, selection.conversationId)
  }

  for (const directory of directories) {
    if (!isDirectoryLoadedForCodeChats(directory)) continue
    const chat = directory.chats.find((candidate) => candidate.id === selection.chatId)
    if (chat) return getChatCodeSelection(directory, chat, selection.conversationId)
  }

  const rememberedDirectory = directories.find(
    (directory) => directory.id === selection.directoryId,
  )
  if (!rememberedDirectory) return null
  return isDirectoryLoadedForCodeChats(rememberedDirectory) ? null : selection
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
  if (input.shouldPreserveSelectedChat) return input.activeView === 'chat' ? 'chat' : 'chat'
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
  ) => Pick<WorkspaceState, 'terminalVisible' | 'restoreTerminalVisibleOnGitOpsClose'>
  getTerminalVisibilityForSession: (
    visibility: Record<string, boolean>,
    conversationId: string | null,
  ) => boolean
  migrateTerminalVisibility: (
    visibility: Record<string, boolean>,
    fromConversationId: string | null,
    toConversationId: string,
  ) => Record<string, boolean>
  shouldRestoreTerminalOnGitOpsClose: (state: WorkspaceState) => boolean
}

export function createCodingWorkspaceTransitions(terminal: TerminalWorkspaceTransitions) {
  const {
    getTerminalStateForNextView,
    getTerminalVisibilityForSession,
    migrateTerminalVisibility,
    shouldRestoreTerminalOnGitOpsClose,
  } = terminal
  const getGitOpsReturnView = (activeView: View, fallback: WorkspaceState['gitOpsReturnView']) =>
    activeView === 'gitops' ? fallback : activeView
  function withCodeChatSelection(
    state: WorkspaceState,
    selection: CodeChatSelection,
  ): WorkspaceState {
    return {
      ...state,
      activeView: 'chat',
      composerProfile: 'coding',
      selectedDirectoryId: selection.directoryId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: selection.chatId,
      selectedConversationId: selection.conversationId,
      terminalVisible: getTerminalVisibilityForSession(
        state.terminalVisibleBySession,
        selection.conversationId,
      ),
      selectedDiffFilePath: null,
      gitOpsReturnView: 'chat',
      utilityViewReturnState: null,
      collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [selection.directoryId]: false },
      lastCodeChatSelection: selection,
    }
  }

  function syncDirectoriesState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'sync-directories' }>,
  ): WorkspaceState {
    const lastCodeChatSelection = resolveCodeChatSelection(
      action.directories,
      state.lastCodeChatSelection,
    )
    const hasSelectedDirectory = action.directories.some(
      (directory) => directory.id === state.selectedDirectoryId,
    )
    const selectedChatDirectory = findDirectoryContainingChat(action.directories, state)
    const shouldPreserveSelectedChat = state.activeView === 'chat' && Boolean(selectedChatDirectory)
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
      gitOpsReturnView:
        getPreservedChatValue(state, shouldPreserveDirectorySelection, state.gitOpsReturnView) ??
        'directories',
      utilityViewReturnState: getPreservedChatValue(
        state,
        shouldPreserveDirectorySelection,
        state.utilityViewReturnState,
      ),
      lastCodeChatSelection,
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
      composerProfile: 'coding',
      selectedDirectoryId: action.directoryId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: action.chatId,
      selectedConversationId: action.conversationId,
      terminalVisible: getTerminalVisibilityForSession(
        nextTerminalVisibleBySession,
        action.conversationId,
      ),
      terminalVisibleBySession: nextTerminalVisibleBySession,
      selectedDiffFilePath: null,
      gitOpsReturnView: 'directory',
      utilityViewReturnState: null,
      collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [action.directoryId]: false },
      lastCodeChatSelection: {
        directoryId: action.directoryId,
        chatId: action.chatId,
        conversationId: action.conversationId,
      },
    }
  }

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
  const codingWorkspaceActionHandlers = {
    'sync-directories': syncDirectoriesState,
    'show-landing': (state: WorkspaceState) => ({
      ...state,
      activeView: 'landing',
      terminalVisible: false,
      selectedDirectoryId: '',
      selectedInboxConversationId: null,
      selectedChatId: null,
      selectedConversationId: null,
      selectedDiffFilePath: null,
      lastCodeChatSelection: null,
      settingsOpen: false,
      settingsPanelOpen: false,
      gitOpsReturnView: 'directories',
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
      composerProfile: 'coding',
      selectedDirectoryId: action.directoryId,
      selectedWorkspaceId: action.workspaceId ?? state.selectedWorkspaceId,
      hasSelectedDirectory: true,
      landingVisible: false,
      selectedChatId: null,
      selectedConversationId: null,
      terminalVisible: state.workspaceTerminalVisibleByWorkspace[action.directoryId] ?? false,
      selectedDiffFilePath: null,
      gitOpsReturnView: 'directory',
      utilityViewReturnState: null,
      lastCodeChatSelection: getScopedCodeChatSelection(state, action.directoryId),
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
      lastCodeChatSelection: getScopedCodeChatSelection(state, action.directoryId),
    }),
    'start-directory-chat': startDirectoryChatState,
    'open-gitops': openGitOpsState,
    'close-gitops': closeGitOpsState,
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

  function restoreCodeChatForView(state: WorkspaceState, view: View): WorkspaceState | null {
    const selection = getCurrentCodeChatSelection(state)
    return view === 'directories' && selection ? withCodeChatSelection(state, selection) : null
  }

  return { codingWorkspaceActionHandlers, withCodeChatSelection, restoreCodeChatForView }
}

export function createInitialCodingWorkspaceState(
  directories: WorkingDirectory[],
): Pick<
  WorkspaceState,
  'gitOpsReturnView' | 'selectedDiffFilePath' | 'collapsedDirectoryIds' | 'lastCodeChatSelection'
> {
  return {
    gitOpsReturnView: 'directories',
    selectedDiffFilePath: null,
    collapsedDirectoryIds: Object.fromEntries(
      directories.map((directory) => [directory.id, directory.collapsed ?? true]),
    ),
    lastCodeChatSelection: null,
  }
}

export function getCodingUtilityReturnState(state: WorkspaceState) {
  return {
    gitOpsReturnView: state.gitOpsReturnView,
    selectedDiffFilePath: state.selectedDiffFilePath,
  }
}

export function getCodingStateForShownView(state: WorkspaceState, view: View) {
  return {
    landingVisible: view === 'directories' ? state.landingVisible : false,
    lastCodeChatSelection: getCurrentCodeChatSelection(state),
    selectedDiffFilePath: view === 'chat' ? state.selectedDiffFilePath : null,
  }
}

export function clearCodingChatSelection() {
  return { selectedDiffFilePath: null, lastCodeChatSelection: null }
}

export function getCodingStateForPreviewedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-chat' | 'open-chat' }>,
): Pick<WorkspaceState, 'selectedDiffFilePath' | 'gitOpsReturnView' | 'collapsedDirectoryIds'> {
  return {
    selectedDiffFilePath: null,
    gitOpsReturnView: 'chat',
    collapsedDirectoryIds: { ...state.collapsedDirectoryIds, [action.directoryId]: false },
  }
}

export function getCodingStateForOpenedChat(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-chat' }>,
) {
  return {
    ...getCodingStateForPreviewedChat(state, action),
    lastCodeChatSelection:
      (action.composerProfile ?? state.composerProfile) === 'general'
        ? state.lastCodeChatSelection
        : {
            directoryId: action.directoryId,
            chatId: action.chatId,
            conversationId: action.conversationId,
          },
  }
}
