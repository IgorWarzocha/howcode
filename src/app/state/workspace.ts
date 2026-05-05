import { isLocalSessionPath } from '../../../shared/session-paths'
import type { Project, Thread, View } from '../types'

type NonGitOpsView = Exclude<View, 'gitops'>
export type UtilityView = Extract<View, 'settings' | 'extensions' | 'skills'>

type UtilityViewReturnState = {
  activeView: View
  selectedProjectId: string
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
  restoreTerminalVisibleOnGitOpsClose: boolean
  takeoverVisible: boolean
  gitOpsReturnView: NonGitOpsView
  selectedDiffFilePath: string | null
}

export type WorkspaceState = {
  activeView: View
  selectedProjectId: string
  selectedInboxSessionPath: string | null
  selectedThreadId: string | null
  selectedSessionPath: string | null
  terminalVisible: boolean
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

export function isUtilityView(view: View): view is UtilityView {
  return view === 'settings' || view === 'extensions' || view === 'skills'
}

function createUtilityViewReturnState(state: WorkspaceState): UtilityViewReturnState {
  return {
    activeView: state.activeView,
    selectedProjectId: state.selectedProjectId,
    selectedInboxSessionPath: state.selectedInboxSessionPath,
    selectedThreadId: state.selectedThreadId,
    selectedSessionPath: state.selectedSessionPath,
    terminalVisible: state.terminalVisible,
    restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    takeoverVisible: state.takeoverVisible,
    gitOpsReturnView: state.gitOpsReturnView,
    selectedDiffFilePath: state.selectedDiffFilePath,
  }
}

function migrateTakeoverOverride(
  takeoverOverrides: Record<string, boolean>,
  fromSessionPath: string | null,
  toSessionPath: string,
) {
  if (!fromSessionPath || fromSessionPath === toSessionPath) {
    return takeoverOverrides
  }

  if (!isLocalSessionPath(fromSessionPath) || isLocalSessionPath(toSessionPath)) {
    return takeoverOverrides
  }

  if (!Object.hasOwn(takeoverOverrides, fromSessionPath)) {
    return takeoverOverrides
  }

  const { [fromSessionPath]: override, ...remainingOverrides } = takeoverOverrides
  return {
    ...remainingOverrides,
    [toSessionPath]: override ?? false,
  }
}

function getGitOpsReturnView(activeView: View, fallback: NonGitOpsView): NonGitOpsView {
  if (activeView === 'gitops') {
    return fallback
  }

  return activeView
}

function getTerminalVisibilityForSession(
  terminalVisibleBySession: Record<string, boolean>,
  sessionPath: string | null,
) {
  return sessionPath ? (terminalVisibleBySession[sessionPath] ?? false) : false
}

function shouldMigrateTerminalVisibilityForOpenedThread(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
) {
  if (
    state.activeView !== 'thread' ||
    !state.selectedSessionPath ||
    state.selectedSessionPath === action.sessionPath
  ) {
    return false
  }

  if (state.selectedThreadId === action.threadId) {
    return !Object.hasOwn(state.terminalVisibleBySession, action.sessionPath)
  }

  return false
}

function getTerminalStateForNextView(state: WorkspaceState, nextView: View) {
  if (state.activeView !== 'gitops') {
    return {
      terminalVisible:
        nextView === 'thread'
          ? getTerminalVisibilityForSession(
              state.terminalVisibleBySession,
              state.selectedSessionPath,
            )
          : state.terminalVisible,
      restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    }
  }

  if (nextView === 'gitops') {
    return {
      terminalVisible: false,
      restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    }
  }

  return {
    terminalVisible: nextView === 'thread' && state.restoreTerminalVisibleOnGitOpsClose,
    restoreTerminalVisibleOnGitOpsClose: false,
  }
}

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  const [firstProject] = projects

  return {
    activeView: 'code',
    selectedProjectId: firstProject?.id ?? '',
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
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

function findProjectContainingThread(projects: Project[], state: WorkspaceState) {
  if (state.selectedSessionPath) {
    return (
      projects.find((project) =>
        project.threads.some((thread) => thread.sessionPath === state.selectedSessionPath),
      ) ?? null
    )
  }

  if (!state.selectedThreadId) {
    return null
  }

  return (
    projects.find((project) =>
      project.threads.some((thread) => thread.id === state.selectedThreadId),
    ) ?? null
  )
}

function getSyncedActiveView(input: {
  actionProjectsLength: number
  hasSelectedProject: boolean
  selectedProjectId: string
  shouldPreserveSelectedThread: boolean
  activeView: View
}) {
  if (input.shouldPreserveSelectedThread) return input.activeView === 'chat' ? 'chat' : 'thread'
  if (input.hasSelectedProject || !input.selectedProjectId || input.actionProjectsLength === 0)
    return input.activeView
  return 'code'
}

function getPreservedThreadValue<T>(
  state: WorkspaceState,
  shouldPreserveProjectSelection: boolean,
  value: T,
) {
  return shouldPreserveProjectSelection || !state.selectedProjectId ? value : null
}

function syncProjectsState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'sync-projects' }>,
): WorkspaceState {
  const hasSelectedProject = action.projects.some(
    (project) => project.id === state.selectedProjectId,
  )
  const selectedProjectId = hasSelectedProject
    ? state.selectedProjectId
    : action.projects[0]?.id || ''
  const selectedThreadProject = findProjectContainingThread(action.projects, state)
  const shouldPreserveSelectedThread =
    (state.activeView === 'chat' || state.activeView === 'thread') && Boolean(selectedThreadProject)
  const shouldPreserveProjectSelection = hasSelectedProject || shouldPreserveSelectedThread
  const collapsedProjectIds = Object.fromEntries(
    action.projects.map((project) => [
      project.id,
      state.collapsedProjectIds[project.id] ?? project.collapsed ?? true,
    ]),
  )
  const nextActiveView = getSyncedActiveView({
    actionProjectsLength: action.projects.length,
    activeView: state.activeView,
    hasSelectedProject,
    selectedProjectId: state.selectedProjectId,
    shouldPreserveSelectedThread,
  })
  return {
    ...state,
    ...getTerminalStateForNextView(state, nextActiveView),
    activeView: nextActiveView,
    selectedProjectId: selectedThreadProject
      ? selectedThreadProject.id
      : shouldPreserveProjectSelection
        ? state.selectedProjectId
        : selectedProjectId,
    selectedThreadId: getPreservedThreadValue(
      state,
      shouldPreserveProjectSelection,
      state.selectedThreadId,
    ),
    selectedSessionPath: getPreservedThreadValue(
      state,
      shouldPreserveProjectSelection,
      state.selectedSessionPath,
    ),
    selectedDiffFilePath: getPreservedThreadValue(
      state,
      shouldPreserveProjectSelection,
      state.selectedDiffFilePath,
    ),
    gitOpsReturnView:
      getPreservedThreadValue(state, shouldPreserveProjectSelection, state.gitOpsReturnView) ??
      'code',
    utilityViewReturnState: getPreservedThreadValue(
      state,
      shouldPreserveProjectSelection,
      state.utilityViewReturnState,
    ),
    collapsedProjectIds,
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  const utilityViewReturnState = isUtilityView(action.view)
    ? isUtilityView(state.activeView)
      ? state.utilityViewReturnState
      : createUtilityViewReturnState(state)
    : null
  return {
    ...state,
    ...getTerminalStateForNextView(state, action.view),
    activeView: action.view,
    settingsOpen: false,
    settingsPanelOpen: false,
    selectedThreadId:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedThreadId
        : null,
    selectedSessionPath:
      action.view === 'thread' || (action.view === 'chat' && state.activeView === 'chat')
        ? state.selectedSessionPath
        : null,
    selectedDiffFilePath: action.view === 'thread' ? state.selectedDiffFilePath : null,
    takeoverVisible: action.view === 'thread' ? state.takeoverVisible : false,
    utilityViewReturnState,
  }
}

function openThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
): WorkspaceState {
  const nextTerminalVisibleBySession = shouldMigrateTerminalVisibilityForOpenedThread(state, action)
    ? {
        ...state.terminalVisibleBySession,
        [action.sessionPath]:
          getTerminalVisibilityForSession(
            state.terminalVisibleBySession,
            state.selectedSessionPath,
          ) ?? false,
      }
    : state.terminalVisibleBySession
  return {
    ...state,
    activeView: action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread'),
    selectedProjectId: action.projectId,
    selectedThreadId: action.threadId,
    selectedSessionPath: action.sessionPath,
    terminalVisible: getTerminalVisibilityForSession(
      nextTerminalVisibleBySession,
      action.sessionPath,
    ),
    terminalVisibleBySession: nextTerminalVisibleBySession,
    takeoverOverrides: migrateTakeoverOverride(
      state.takeoverOverrides,
      state.selectedSessionPath,
      action.sessionPath,
    ),
    selectedDiffFilePath: null,
    gitOpsReturnView: 'thread',
    utilityViewReturnState: null,
    collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
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
        : state.activeView === 'thread' && state.terminalVisible,
    takeoverVisible: false,
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
    selectedThreadId:
      state.gitOpsReturnView === 'chat' || state.gitOpsReturnView === 'thread'
        ? state.selectedThreadId
        : null,
    selectedSessionPath:
      state.gitOpsReturnView === 'chat' || state.gitOpsReturnView === 'thread'
        ? state.selectedSessionPath
        : null,
    selectedDiffFilePath: null,
    utilityViewReturnState: null,
  }
}

function setTerminalVisibleState(state: WorkspaceState, visible: boolean): WorkspaceState {
  if (!state.selectedSessionPath) return { ...state, terminalVisible: visible }
  return {
    ...state,
    terminalVisible: visible,
    terminalVisibleBySession: {
      ...state.terminalVisibleBySession,
      [state.selectedSessionPath]: visible,
    },
  }
}

function setSessionTakeoverOverrideState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'set-session-takeover-override' }>,
): WorkspaceState {
  if (action.visible === null) {
    const { [action.sessionPath]: _removedOverride, ...remainingOverrides } =
      state.takeoverOverrides
    return { ...state, takeoverOverrides: remainingOverrides }
  }
  return {
    ...state,
    takeoverOverrides: { ...state.takeoverOverrides, [action.sessionPath]: action.visible },
  }
}

const workspaceActionHandlers = {
  'sync-projects': syncProjectsState,
  'show-view': showViewState,
  'close-utility-view': (state: WorkspaceState) =>
    state.utilityViewReturnState
      ? {
          ...state,
          ...state.utilityViewReturnState,
          settingsOpen: false,
          settingsPanelOpen: false,
          utilityViewReturnState: null,
        }
      : state,
  'clear-thread-selection': (state: WorkspaceState) => ({
    ...state,
    selectedThreadId: null,
    selectedSessionPath: null,
    selectedDiffFilePath: null,
    takeoverVisible: false,
  }),
  'select-inbox-thread': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-inbox-thread' }>,
  ) => ({ ...state, selectedInboxSessionPath: action.sessionPath }),
  'select-project': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'select-project' }>,
  ) => ({
    ...state,
    ...getTerminalStateForNextView(state, 'code'),
    activeView: 'code',
    selectedProjectId: action.projectId,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    selectedDiffFilePath: null,
    takeoverVisible: false,
    gitOpsReturnView: 'code',
    utilityViewReturnState: null,
  }),
  'set-selected-project': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-selected-project' }>,
  ) => ({ ...state, selectedProjectId: action.projectId }),
  'open-thread': openThreadState,
  'open-gitops': openGitOpsState,
  'close-gitops': closeGitOpsState,
  'toggle-terminal': (state: WorkspaceState) =>
    setTerminalVisibleState(state, !state.terminalVisible),
  'set-terminal-visible': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-terminal-visible' }>,
  ) => setTerminalVisibleState(state, action.visible),
  'show-takeover': (state: WorkspaceState) => ({ ...state, takeoverVisible: true }),
  'hide-takeover': (state: WorkspaceState) => ({ ...state, takeoverVisible: false }),
  'set-takeover-visible': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-takeover-visible' }>,
  ) => ({ ...state, takeoverVisible: action.visible }),
  'set-session-takeover-override': setSessionTakeoverOverrideState,
  'toggle-settings': (state: WorkspaceState) => ({ ...state, settingsOpen: !state.settingsOpen }),
  'set-settings-panel-open': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-settings-panel-open' }>,
  ) => ({
    ...state,
    settingsPanelOpen: action.open,
    settingsOpen: action.open ? false : state.settingsOpen,
  }),
  'toggle-project-collapse': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'toggle-project-collapse' }>,
  ) => ({
    ...state,
    collapsedProjectIds: {
      ...state.collapsedProjectIds,
      [action.projectId]: !state.collapsedProjectIds[action.projectId],
    },
  }),
  'collapse-all-projects': (state: WorkspaceState) => ({
    ...state,
    collapsedProjectIds: Object.fromEntries(
      Object.keys(state.collapsedProjectIds).map((projectId) => [projectId, true]),
    ),
  }),
} satisfies {
  [Action in WorkspaceAction as Action['type']]: (
    state: WorkspaceState,
    action: Action,
  ) => WorkspaceState
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  const handler = workspaceActionHandlers[action.type] as (
    state: WorkspaceState,
    action: WorkspaceAction,
  ) => WorkspaceState
  return handler(state, action)
}

export function selectProject(projects: Project[], selectedProjectId: string): Project | undefined {
  return projects.find((project) => project.id === selectedProjectId) ?? projects[0]
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
