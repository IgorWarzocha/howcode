import type { Project, Thread, View } from '../types'
import { workspaceActionHandlers } from './workspace-action-handlers'

export type NonGitOpsView = Exclude<View, 'gitops'>
export type UtilityView = Extract<View, 'settings' | 'extensions' | 'skills'>

export type UtilityViewReturnState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
  projectTerminalVisibleByProject: Record<string, boolean>
  restoreTerminalVisibleOnGitOpsClose: boolean
  takeoverVisible: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedProjectId: string
  hasSelectedProject: boolean
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
  projectTerminalVisibleByProject: Record<string, boolean>
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
}

export type WorkspaceAction =
  | { type: 'sync-projects'; projects: Project[] }
  | { type: 'show-view'; view: NonGitOpsView }
  | { type: 'show-landing' }
  | { type: 'close-utility-view' }
  | { type: 'select-inbox-thread'; sessionPath: string | null }
  | { type: 'clear-thread-selection' }
  | { type: 'select-project'; projectId: string }
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

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  return {
    activeView: 'code',
    selectedProjectId: '',
    hasSelectedProject: false,
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    projectTerminalVisibleByProject: {},
    terminalVisibleBySession: {},
    restoreTerminalVisibleOnGitOpsClose: false,
    takeoverVisible: false,
    takeoverOverrides: {},
    gitOpsReturnView: 'code',
    selectedDiffFilePath: null,
    utilityViewReturnState: null,
    settingsOpen: false,
    settingsPanelOpen: false,
    collapsedProjectIds: Object.fromEntries(
      projects.map((project) => [project.id, project.collapsed ?? true]),
    ),
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

export function selectProject(projects: Project[], selectedProjectId: string): Project | undefined {
  if (!selectedProjectId) return undefined
  return projects.find((project) => project.id === selectedProjectId)
}

export function selectThread(
  project: Project | undefined,
  selectedThreadId: string | null,
): Thread | undefined {
  if (!(project && selectedThreadId)) {
    return undefined
  }

  return project.threads.find((thread) => thread.id === selectedThreadId)
}

export function getCurrentTitle(activeView: View, selectedThread: Thread | undefined): string {
  if (activeView === 'gitops') {
    return 'Git ops'
  }

  if (activeView === 'archived') {
    return 'Archived threads'
  }

  return (activeView === 'chat' || activeView === 'thread') && selectedThread
    ? selectedThread.title
    : 'New thread'
}

export function getProjectName(project: Project | undefined): string {
  return project?.name ?? 'Pi'
}
