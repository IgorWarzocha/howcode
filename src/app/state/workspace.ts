import { createInitialTerminalWorkspaceState } from '@howcode/components/terminal/ui'
import { createInitialDirectoryWorkspaceState } from '@howcode/components/working-directories/ui'
import type { Chat, View, WorkingDirectory } from '../types'
import { workspaceActionHandlers } from './workspace-action-handlers'
import type { WorkspaceAction, WorkspaceState } from './workspace-model'

export type {
  CodeChatSelection,
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

export function createInitialWorkspaceState(directories: WorkingDirectory[]): WorkspaceState {
  return {
    activeView: 'landing',
    selectedWorkspaceId: null,
    composerProfile: 'general',
    selectedDirectoryId: '',
    hasSelectedDirectory: false,
    landingVisible: true,
    selectedInboxConversationId: null,
    selectedChatId: null,
    selectedConversationId: null,
    gitDetailDirectoryId: null,
    ...createInitialTerminalWorkspaceState(),
    ...createInitialDirectoryWorkspaceState(directories),
    utilityViewReturnState: null,
    settingsOpen: false,
    settingsPanelOpen: false,
  }
}

export { isUtilityView } from './workspace-action-handlers'

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  const handler = workspaceActionHandlers[action.type] as (
    state: WorkspaceState,
    action: WorkspaceAction,
  ) => WorkspaceState
  return handler(state, action)
}

export function selectDirectory(
  directories: WorkingDirectory[],
  selectedDirectoryId: string,
): WorkingDirectory | undefined {
  if (!selectedDirectoryId) return undefined
  return directories.find((directory) => directory.id === selectedDirectoryId)
}

export function selectChat(
  directory: WorkingDirectory | undefined,
  selectedChatId: string | null,
): Chat | undefined {
  if (!(directory && selectedChatId)) {
    return undefined
  }

  return directory.chats.find((chat) => chat.id === selectedChatId)
}

export function getCurrentTitle(activeView: View, selectedChat: Chat | undefined): string {
  if (activeView === 'landing') {
    return 'About'
  }

  if (activeView === 'directory') {
    return 'Workspace overview'
  }

  if (activeView === 'archived') {
    return 'Archived chats'
  }

  if (activeView === 'history') {
    return 'Past chats'
  }

  return activeView === 'chat' && selectedChat ? selectedChat.title : 'New chat'
}

export function getDirectoryName(directory: WorkingDirectory | undefined): string {
  return directory?.name ?? 'Pi'
}
