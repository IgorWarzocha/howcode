import type { Project, Thread, View } from '../types'
import { workspaceActionHandlers } from './workspace-action-handlers'
import type { WorkspaceAction, WorkspaceState } from './workspace-model'

export type {
  CodeThreadSelection,
  NonGitOpsView,
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace-model'

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  return {
    activeView: 'landing',
    selectedProjectId: '',
    hasSelectedProject: false,
    landingVisible: true,
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    workspaceTerminalVisibleByWorkspace: {},
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
    lastCodeThreadSelection: null,
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
  if (activeView === 'landing') {
    return 'About'
  }

  if (activeView === 'project') {
    return 'Project overview'
  }

  if (activeView === 'gitops') {
    return 'Git ops'
  }

  if (activeView === 'archived') {
    return 'Archived threads'
  }

  if (activeView === 'sessions') {
    return 'Sessions'
  }

  return (activeView === 'chat' || activeView === 'thread') && selectedThread
    ? selectedThread.title
    : 'New thread'
}

export function getProjectName(project: Project | undefined): string {
  return project?.name ?? 'Pi'
}
