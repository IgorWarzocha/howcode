import type { Project, View } from '../types'

export type NonGitOpsView = Exclude<View, 'gitops'>
export type UtilityView = Extract<View, 'settings' | 'extensions' | 'skills' | 'sessions'>

export type CodeThreadSelection = {
  projectId: string
  threadId: string
  sessionPath: string
}

export type UtilityViewReturnState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  landingVisible: boolean
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  takeoverVisible: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  landingVisible: boolean
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
  workspaceTerminalVisibleByWorkspace: Record<string, boolean>
  terminalVisibleBySession: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  takeoverVisible: boolean
  takeoverOverrides: Record<string, boolean>
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
  | { type: 'select-inbox-thread'; sessionPath: string | null }
  | { type: 'clear-thread-selection' }
  | { type: 'select-project'; projectId: string }
  | {
      type: 'start-project-thread'
      projectId: string
      threadId: string
      sessionPath: string
    }
  | { type: 'set-selected-project'; projectId: string }
  | {
      type: 'open-thread'
      projectId: string
      threadId: string
      sessionPath: string
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
  | { type: 'show-takeover' }
  | { type: 'hide-takeover' }
  | { type: 'set-takeover-visible'; visible: boolean }
  | { type: 'set-session-takeover-override'; sessionPath: string; visible: boolean | null }
  | { type: 'toggle-settings' }
  | { type: 'set-settings-panel-open'; open: boolean }
  | { type: 'toggle-project-collapse'; projectId: string }
  | { type: 'collapse-all-projects' }
