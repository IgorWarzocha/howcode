import type {
  CodeThreadSelection,
  WorkspaceAction,
  WorkspaceState,
} from '../../../../src/app/state/workspace-model'
import type { Project, View } from '../../../../src/app/types'

export function getCurrentCodeThreadSelection(state: WorkspaceState): CodeThreadSelection | null {
  if (
    (state.activeView === 'thread' || state.activeView === 'project') &&
    state.selectedProjectId &&
    state.selectedThreadId &&
    state.selectedConversationId
  ) {
    return {
      projectId: state.selectedProjectId,
      threadId: state.selectedThreadId,
      conversationId: state.selectedConversationId,
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
  fallbackConversationId: string,
): CodeThreadSelection {
  return {
    projectId: project.id,
    threadId: thread.id,
    conversationId: thread.conversationId ?? fallbackConversationId,
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
      (candidate) => candidate.conversationId === selection.conversationId,
    )
    if (thread) return getThreadCodeSelection(project, thread, selection.conversationId)
  }

  for (const project of projects) {
    if (!isProjectLoadedForCodeThreads(project)) continue
    const thread = project.threads.find((candidate) => candidate.id === selection.threadId)
    if (thread) return getThreadCodeSelection(project, thread, selection.conversationId)
  }

  const rememberedProject = projects.find((project) => project.id === selection.projectId)
  if (!rememberedProject) return null
  return isProjectLoadedForCodeThreads(rememberedProject) ? null : selection
}

function findProjectContainingThread(projects: Project[], state: WorkspaceState) {
  if (state.selectedConversationId) {
    return (
      projects.find((project) =>
        project.threads.some((thread) => thread.conversationId === state.selectedConversationId),
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
      selectedConversationId: selection.conversationId,
      terminalVisible: getTerminalVisibilityForSession(
        state.terminalVisibleBySession,
        selection.conversationId,
      ),
      selectedDiffFilePath: null,
      gitOpsReturnView: 'thread',
      utilityViewReturnState: null,
      collapsedProjectIds: { ...state.collapsedProjectIds, [selection.projectId]: false },
      lastCodeThreadSelection: selection,
    }
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
      (state.activeView === 'chat' || state.activeView === 'thread') &&
      Boolean(selectedThreadProject)
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
      selectedProjectId:
        selectedThreadProject?.id ??
        (shouldPreserveProjectSelection ? state.selectedProjectId : ''),
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
      selectedConversationId: getPreservedThreadValue(
        state,
        shouldPreserveProjectSelection,
        state.selectedConversationId,
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

  function startProjectThreadState(
    state: WorkspaceState,
    action: Extract<WorkspaceAction, { type: 'start-project-thread' }>,
  ): WorkspaceState {
    const nextTerminalVisibleBySession = migrateTerminalVisibility(
      state.terminalVisibleBySession,
      state.selectedConversationId,
      action.conversationId,
    )
    return {
      ...state,
      ...getTerminalStateForNextView(state, 'project'),
      activeView: 'project',
      selectedProjectId: action.projectId,
      hasSelectedProject: true,
      landingVisible: false,
      selectedThreadId: action.threadId,
      selectedConversationId: action.conversationId,
      terminalVisible: getTerminalVisibilityForSession(
        nextTerminalVisibleBySession,
        action.conversationId,
      ),
      terminalVisibleBySession: nextTerminalVisibleBySession,
      selectedDiffFilePath: null,
      gitOpsReturnView: 'project',
      utilityViewReturnState: null,
      collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
      lastCodeThreadSelection: {
        projectId: action.projectId,
        threadId: action.threadId,
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
      selectedThreadId:
        state.gitOpsReturnView === 'chat' || state.gitOpsReturnView === 'thread'
          ? state.selectedThreadId
          : null,
      selectedConversationId:
        state.gitOpsReturnView === 'chat' || state.gitOpsReturnView === 'thread'
          ? state.selectedConversationId
          : null,
      selectedDiffFilePath: null,
      utilityViewReturnState: null,
    }
  }
  const codingWorkspaceActionHandlers = {
    'sync-projects': syncProjectsState,
    'show-landing': (state: WorkspaceState) => ({
      ...state,
      activeView: 'landing',
      terminalVisible: false,
      selectedProjectId: '',
      selectedInboxConversationId: null,
      selectedThreadId: null,
      selectedConversationId: null,
      selectedDiffFilePath: null,
      lastCodeThreadSelection: null,
      settingsOpen: false,
      settingsPanelOpen: false,
      gitOpsReturnView: 'code',
      utilityViewReturnState: null,
      hasSelectedProject: false,
      landingVisible: true,
    }),
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
      selectedConversationId: null,
      terminalVisible: state.workspaceTerminalVisibleByWorkspace[action.projectId] ?? false,
      selectedDiffFilePath: null,
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
    'open-gitops': openGitOpsState,
    'close-gitops': closeGitOpsState,
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
  } satisfies Partial<{
    [Action in WorkspaceAction as Action['type']]: (
      state: WorkspaceState,
      action: Action,
    ) => WorkspaceState
  }>

  function restoreCodeThreadForView(state: WorkspaceState, view: View): WorkspaceState | null {
    const selection = getCurrentCodeThreadSelection(state)
    return view === 'code' && selection ? withCodeThreadSelection(state, selection) : null
  }

  return { codingWorkspaceActionHandlers, withCodeThreadSelection, restoreCodeThreadForView }
}

export function createInitialCodingWorkspaceState(
  projects: Project[],
): Pick<
  WorkspaceState,
  'gitOpsReturnView' | 'selectedDiffFilePath' | 'collapsedProjectIds' | 'lastCodeThreadSelection'
> {
  return {
    gitOpsReturnView: 'code',
    selectedDiffFilePath: null,
    collapsedProjectIds: Object.fromEntries(
      projects.map((project) => [project.id, project.collapsed ?? true]),
    ),
    lastCodeThreadSelection: null,
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
    landingVisible: view === 'code' ? state.landingVisible : false,
    lastCodeThreadSelection: getCurrentCodeThreadSelection(state),
    selectedDiffFilePath: view === 'thread' ? state.selectedDiffFilePath : null,
  }
}

export function clearCodingThreadSelection() {
  return { selectedDiffFilePath: null, lastCodeThreadSelection: null }
}

export function getCodingStateForPreviewedThread(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'preview-thread' | 'open-thread' }>,
): Pick<WorkspaceState, 'selectedDiffFilePath' | 'gitOpsReturnView' | 'collapsedProjectIds'> {
  return {
    selectedDiffFilePath: null,
    gitOpsReturnView: 'thread',
    collapsedProjectIds: { ...state.collapsedProjectIds, [action.projectId]: false },
  }
}

export function getCodingStateForOpenedThread(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'open-thread' }>,
  activeView: View,
) {
  return {
    ...getCodingStateForPreviewedThread(state, action),
    lastCodeThreadSelection:
      activeView === 'chat'
        ? state.lastCodeThreadSelection
        : {
            projectId: action.projectId,
            threadId: action.threadId,
            conversationId: action.conversationId,
          },
  }
}
