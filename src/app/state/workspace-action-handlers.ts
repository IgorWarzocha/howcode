import type { Project, View } from '../types'
import type {
  CodeThreadSelection,
  UtilityView,
  UtilityViewReturnState,
  WorkspaceAction,
  WorkspaceState,
} from './workspace'
import {
  getGitOpsReturnView,
  getTerminalStateForNextView,
  getTerminalVisibilityForSession,
  migrateTakeoverOverride,
  migrateTerminalVisibility,
  setTerminalVisibleState,
  shouldMigrateTerminalVisibilityForOpenedThread,
  shouldRestoreTerminalOnGitOpsClose,
} from './workspace-terminal-state'

export function isUtilityView(view: View): view is UtilityView {
  return view === 'settings' || view === 'extensions' || view === 'skills' || view === 'sessions'
}

function createUtilityViewReturnState(state: WorkspaceState): UtilityViewReturnState {
  return {
    activeView: state.activeView,
    selectedProjectId: state.selectedProjectId,
    hasSelectedProject: state.hasSelectedProject,
    landingVisible: state.landingVisible,
    selectedInboxSessionPath: state.selectedInboxSessionPath,
    selectedThreadId: state.selectedThreadId,
    selectedSessionPath: state.selectedSessionPath,
    terminalVisible: state.terminalVisible,
    workspaceTerminalVisibleByWorkspace: state.workspaceTerminalVisibleByWorkspace,
    restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    takeoverVisible: state.takeoverVisible,
    gitOpsReturnView: state.gitOpsReturnView,
    selectedDiffFilePath: state.selectedDiffFilePath,
  }
}

function getCurrentCodeThreadSelection(state: WorkspaceState): CodeThreadSelection | null {
  if (
    (state.activeView === 'thread' || state.activeView === 'project') &&
    state.selectedProjectId &&
    state.selectedThreadId &&
    state.selectedSessionPath
  ) {
    return {
      projectId: state.selectedProjectId,
      threadId: state.selectedThreadId,
      sessionPath: state.selectedSessionPath,
    }
  }

  return state.lastCodeThreadSelection
}

function getScopedCodeThreadSelection(
  state: WorkspaceState,
  projectId: string,
): CodeThreadSelection | null {
  return state.lastCodeThreadSelection?.projectId === projectId
    ? state.lastCodeThreadSelection
    : null
}

function isProjectLoadedForCodeThreads(project: Project) {
  return project.threadsLoaded === true && project.threadsScope !== 'chat'
}

function getThreadCodeSelection(
  project: Project,
  thread: Project['threads'][number],
  fallbackSessionPath: string,
): CodeThreadSelection {
  return {
    projectId: project.id,
    threadId: thread.id,
    sessionPath: thread.sessionPath ?? fallbackSessionPath,
  }
}

export function resolveCodeThreadSelection(
  projects: Project[],
  selection: CodeThreadSelection | null,
): CodeThreadSelection | null {
  if (!selection) return null

  for (const project of projects) {
    if (!isProjectLoadedForCodeThreads(project)) continue
    const thread = project.threads.find(
      (candidate) => candidate.sessionPath === selection.sessionPath,
    )
    if (thread) return getThreadCodeSelection(project, thread, selection.sessionPath)
  }

  for (const project of projects) {
    if (!isProjectLoadedForCodeThreads(project)) continue
    const thread = project.threads.find((candidate) => candidate.id === selection.threadId)
    if (thread) return getThreadCodeSelection(project, thread, selection.sessionPath)
  }

  const rememberedProject = projects.find((project) => project.id === selection.projectId)
  if (!rememberedProject) return null
  return isProjectLoadedForCodeThreads(rememberedProject) ? null : selection
}

function withCodeThreadSelection(
  state: WorkspaceState,
  selection: CodeThreadSelection,
): WorkspaceState {
  return {
    ...state,
    activeView: 'thread',
    selectedProjectId: selection.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: selection.threadId,
    selectedSessionPath: selection.sessionPath,
    terminalVisible: getTerminalVisibilityForSession(
      state.terminalVisibleBySession,
      selection.sessionPath,
    ),
    selectedDiffFilePath: null,
    takeoverVisible: false,
    gitOpsReturnView: 'thread',
    utilityViewReturnState: null,
    collapsedProjectIds: { ...state.collapsedProjectIds, [selection.projectId]: false },
    lastCodeThreadSelection: selection,
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
  if (input.activeView === 'project' && !input.hasSelectedProject) return 'code'
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
  const lastCodeThreadSelection = resolveCodeThreadSelection(
    action.projects,
    state.lastCodeThreadSelection,
  )
  const hasSelectedProject = action.projects.some(
    (project) => project.id === state.selectedProjectId,
  )
  const selectedThreadProject = findProjectContainingThread(action.projects, state)
  const shouldPreserveSelectedThread =
    (state.activeView === 'chat' || state.activeView === 'thread') && Boolean(selectedThreadProject)
  const shouldPreserveProjectSelection = hasSelectedProject || shouldPreserveSelectedThread
  const nextHasSelectedProject = Boolean(selectedThreadProject) || hasSelectedProject
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
        : '',
    hasSelectedProject:
      nextHasSelectedProject && (state.hasSelectedProject || shouldPreserveProjectSelection),
    landingVisible:
      state.landingVisible && !selectedThreadProject && !state.hasSelectedProject
        ? true
        : state.landingVisible && shouldPreserveProjectSelection,
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
    lastCodeThreadSelection,
    collapsedProjectIds,
  }
}

function showViewState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'show-view' }>,
): WorkspaceState {
  const lastCodeThreadSelection = getCurrentCodeThreadSelection(state)
  if (action.view === 'code' && lastCodeThreadSelection) {
    return withCodeThreadSelection(state, lastCodeThreadSelection)
  }

  const utilityViewReturnState = isUtilityView(action.view)
    ? isUtilityView(state.activeView)
      ? state.utilityViewReturnState
      : createUtilityViewReturnState(state)
    : null
  return {
    ...state,
    ...getTerminalStateForNextView(state, action.view),
    activeView: action.view,
    landingVisible: action.view === 'code' ? state.landingVisible : false,
    settingsOpen: false,
    settingsPanelOpen: false,
    lastCodeThreadSelection,
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
  const activeView = action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread')
  const nextTerminalVisibleBySession = shouldMigrateTerminalVisibilityForOpenedThread(state, action)
    ? {
        ...state.terminalVisibleBySession,
        [action.sessionPath]:
          state.activeView === 'project'
            ? (state.workspaceTerminalVisibleByWorkspace[action.projectId] ?? false)
            : getTerminalVisibilityForSession(
                state.terminalVisibleBySession,
                state.selectedSessionPath,
              ),
      }
    : state.terminalVisibleBySession
  return {
    ...state,
    activeView,
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
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
    lastCodeThreadSelection:
      activeView === 'chat'
        ? state.lastCodeThreadSelection
        : {
            projectId: action.projectId,
            threadId: action.threadId,
            sessionPath: action.sessionPath,
          },
  }
}

function startProjectThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'start-project-thread' }>,
): WorkspaceState {
  const nextTerminalVisibleBySession = migrateTerminalVisibility(
    state.terminalVisibleBySession,
    state.selectedSessionPath,
    action.sessionPath,
  )
  return {
    ...state,
    ...getTerminalStateForNextView(state, 'project'),
    activeView: 'project',
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
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
    gitOpsReturnView: 'project',
    utilityViewReturnState: null,
    collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
    lastCodeThreadSelection: {
      projectId: action.projectId,
      threadId: action.threadId,
      sessionPath: action.sessionPath,
    },
  }
}

function previewThreadState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-thread' }>,
): WorkspaceState {
  return {
    ...state,
    activeView: action.view ?? (state.activeView === 'chat' ? 'chat' : 'thread'),
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: action.threadId,
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
        : shouldRestoreTerminalOnGitOpsClose(state),
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

export const workspaceActionHandlers = {
  'sync-projects': syncProjectsState,
  'show-view': showViewState,
  'show-landing': (state: WorkspaceState) => ({
    ...state,
    activeView: 'landing',
    terminalVisible: false,
    selectedProjectId: '',
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    selectedDiffFilePath: null,
    lastCodeThreadSelection: null,
    takeoverVisible: false,
    settingsOpen: false,
    settingsPanelOpen: false,
    gitOpsReturnView: 'code',
    utilityViewReturnState: null,
    hasSelectedProject: false,
    landingVisible: true,
  }),
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
    lastCodeThreadSelection: null,
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
    ...getTerminalStateForNextView(state, 'project'),
    activeView: 'project',
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: state.workspaceTerminalVisibleByWorkspace[action.projectId] ?? false,
    selectedDiffFilePath: null,
    takeoverVisible: false,
    gitOpsReturnView: 'project',
    utilityViewReturnState: null,
    lastCodeThreadSelection: getScopedCodeThreadSelection(state, action.projectId),
  }),
  'set-selected-project': (
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'set-selected-project' }>,
  ) => ({
    ...state,
    selectedProjectId: action.projectId,
    hasSelectedProject: true,
    landingVisible: false,
    lastCodeThreadSelection: getScopedCodeThreadSelection(state, action.projectId),
  }),
  'start-project-thread': startProjectThreadState,
  'preview-thread': previewThreadState,
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
