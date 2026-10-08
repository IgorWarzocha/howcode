import type { ComposerProfile } from '@howcode/shared/desktop-composer-contracts'
import type { View, WorkingDirectory } from '../types'

export type NonGitOpsView = Exclude<View, 'gitops'>
export type UtilityView = Extract<View, 'settings' | 'skills' | 'history'>

export type CodeChatSelection = {
  directoryId: string
  chatId: string
  conversationId: string
}

export type UtilityViewReturnState = {
  activeView: View
  selectedWorkspaceId: string | null
  composerProfile: ComposerProfile
  selectedDirectoryId: string
  hasSelectedDirectory: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedChatId: string | null
  selectedConversationId: string | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedWorkspaceId: string | null
  composerProfile: ComposerProfile
  selectedDirectoryId: string
  hasSelectedDirectory: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedChatId: string | null
  selectedConversationId: string | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  terminalVisibleBySession: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
  utilityViewReturnState: UtilityViewReturnState | null
  settingsOpen: boolean
  settingsPanelOpen: boolean
  collapsedDirectoryIds: Record<string, boolean>
  lastCodeChatSelection: CodeChatSelection | null
}

export type WorkspaceAction =
  | { type: 'sync-directories'; directories: WorkingDirectory[] }
  | {
      type: 'select-workspace'
      workspaceId: string | null
      directoryId?: string | null | undefined
    }
  | { type: 'show-view'; view: NonGitOpsView }
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
      composerProfile?: ComposerProfile | undefined
      workspaceId?: string | null | undefined
    }
  | {
      type: 'preview-chat'
      directoryId: string
      chatId: string
      composerProfile?: ComposerProfile | undefined
      workspaceId?: string | null | undefined
    }
  | {
      type: 'open-gitops'
      filePath?: string | null
      returnView?: NonGitOpsView
    }
  | { type: 'close-gitops' }
  | { type: 'toggle-terminal' }
  | { type: 'set-terminal-visible'; visible: boolean }
  | { type: 'toggle-settings' }
  | { type: 'set-settings-panel-open'; open: boolean }
  | { type: 'toggle-directory-collapse'; directoryId: string }
  | { type: 'collapse-all-directories' }
