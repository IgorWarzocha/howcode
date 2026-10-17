import type { View, WorkingDirectory } from '../types'

export type UtilityView = Extract<View, 'settings' | 'skills' | 'history'>

export type ChatSelection = {
  directoryId: string
  chatId: string
  conversationId: string
}

export type UtilityViewReturnState = {
  utilityViewReturnState: UtilityViewReturnState | null
  activeView: View
  selectedWorkspaceId: string | null
  selectedDirectoryId: string
  hasSelectedDirectory: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedChatId: string | null
  selectedConversationId: string | null
  composerExtensions: string[] | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedWorkspaceId: string | null
  selectedDirectoryId: string
  hasSelectedDirectory: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedChatId: string | null
  selectedConversationId: string | null
  composerExtensions: string[] | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  terminalVisibleBySession: Record<string, boolean>
  gitDetailDirectoryId: string | null
  selectedDiffFilePath: string | null
  utilityViewReturnState: UtilityViewReturnState | null
  settingsPanelOpen: boolean
  collapsedDirectoryIds: Record<string, boolean>
  lastChatSelection: ChatSelection | null
}

export type WorkspaceAction =
  | {
      type: 'set-composer-extensions'
      extensions: string[]
      conversationId: string | null
      directoryId: string
      workspaceId: string | null
    }
  | { type: 'sync-directories'; directories: WorkingDirectory[] }
  | {
      type: 'select-workspace'
      workspaceId: string | null
      directoryId?: string | null | undefined
    }
  | { type: 'show-view'; view: View }
  | { type: 'show-landing' }
  | { type: 'close-utility-view' }
  | { type: 'select-inbox-chat'; conversationId: string | null }
  | { type: 'clear-chat-selection' }
  | { type: 'select-directory'; directoryId: string; workspaceId?: string | undefined }
  | {
      type: 'start-directory-chat'
      directoryId: string
      chatId: string
      conversationId: string
    }
  | { type: 'set-selected-directory'; directoryId: string; workspaceId?: string | undefined }
  | {
      type: 'open-chat'
      directoryId: string
      chatId: string
      conversationId: string
      composerExtensions?: string[] | undefined
      workspaceId?: string | null | undefined
    }
  | {
      type: 'preview-chat'
      directoryId: string
      chatId: string
      workspaceId?: string | null | undefined
    }
  | {
      type: 'open-gitops'
      filePath?: string | null
    }
  | { type: 'close-gitops' }
  | { type: 'toggle-terminal' }
  | { type: 'set-terminal-visible'; visible: boolean }
  | { type: 'set-settings-panel-open'; open: boolean }
  | { type: 'toggle-directory-collapse'; directoryId: string }
  | { type: 'collapse-all-directories' }
