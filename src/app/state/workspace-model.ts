import type { Project, View } from '../types'

export type NonGitOpsView = Exclude<View, 'gitops'>
export type UtilityView = Extract<View, 'settings' | 'skills' | 'sessions'>

export type CodeThreadSelection = {
  projectId: string
  threadId: string
  conversationId: string
}

export type UtilityViewReturnState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedThreadId: string | null
  selectedConversationId: string | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  landingVisible: boolean
  selectedInboxConversationId: string | null
  selectedThreadId: string | null
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
  collapsedProjectIds: Record<string, boolean>
  lastCodeThreadSelection: CodeThreadSelection | null
}

export type WorkspaceAction =
  | { type: 'sync-projects'; projects: Project[] }
  | { type: 'show-view'; view: NonGitOpsView }
  | { type: 'show-landing' }
  | { type: 'close-utility-view' }
  | { type: 'select-inbox-thread'; conversationId: string | null }
  | { type: 'clear-thread-selection' }
  | { type: 'select-project'; projectId: string }
  | {
      type: 'start-project-thread'
      projectId: string
      threadId: string
      conversationId: string
    }
  | { type: 'set-selected-project'; projectId: string }
  | {
      type: 'open-thread'
      projectId: string
      threadId: string
      conversationId: string
      view?: 'chat' | 'thread' | undefined
    }
  | {
      type: 'preview-thread'
      projectId: string
      threadId: string
      view?: 'chat' | 'thread' | undefined
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
  | { type: 'toggle-project-collapse'; projectId: string }
  | { type: 'collapse-all-projects' }
