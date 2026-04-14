import type { Project, Thread, View } from "../types";

type NonGitOpsView = Exclude<View, "gitops">;

export type WorkspaceState = {
  activeView: View;
  selectedProjectId: string;
  selectedInboxSessionPath: string | null;
  selectedThreadId: string | null;
  selectedSessionPath: string | null;
  terminalVisible: boolean;
  restoreTerminalVisibleOnGitOpsClose: boolean;
  takeoverVisible: boolean;
  takeoverOverrides: Record<string, boolean>;
  gitOpsReturnView: NonGitOpsView;
  selectedDiffTurnCount: number | null;
  selectedDiffFilePath: string | null;
  settingsOpen: boolean;
  settingsPanelOpen: boolean;
  archivedThreadsOpen: boolean;
  collapsedProjectIds: Record<string, boolean>;
};

export type WorkspaceAction =
  | { type: "sync-projects"; projects: Project[] }
  | { type: "show-view"; view: NonGitOpsView }
  | { type: "select-inbox-thread"; sessionPath: string | null }
  | { type: "select-project"; projectId: string }
  | { type: "set-selected-project"; projectId: string }
  | { type: "open-thread"; projectId: string; threadId: string; sessionPath: string }
  | {
      type: "open-gitops";
      checkpointTurnCount: number | null;
      filePath?: string | null;
      returnView?: NonGitOpsView;
    }
  | { type: "close-gitops" }
  | { type: "toggle-terminal" }
  | { type: "set-terminal-visible"; visible: boolean }
  | { type: "show-takeover" }
  | { type: "hide-takeover" }
  | { type: "set-takeover-visible"; visible: boolean }
  | { type: "set-session-takeover-override"; sessionPath: string; visible: boolean | null }
  | { type: "set-diff-turn"; checkpointTurnCount: number | null }
  | { type: "toggle-settings" }
  | { type: "set-settings-panel-open"; open: boolean }
  | { type: "set-archived-threads-open"; open: boolean }
  | { type: "toggle-project-collapse"; projectId: string }
  | { type: "collapse-all-projects" };

function getGitOpsReturnView(activeView: View, fallback: NonGitOpsView): NonGitOpsView {
  if (activeView === "gitops") {
    return fallback;
  }

  return activeView;
}

function getTerminalStateForNextView(state: WorkspaceState, nextView: View) {
  if (state.activeView !== "gitops") {
    return {
      terminalVisible: state.terminalVisible,
      restoreTerminalVisibleOnGitOpsClose: state.restoreTerminalVisibleOnGitOpsClose,
    };
  }

  return {
    terminalVisible: nextView === "thread" && state.restoreTerminalVisibleOnGitOpsClose,
    restoreTerminalVisibleOnGitOpsClose: false,
  };
}

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  const [firstProject] = projects;

  return {
    activeView: "code",
    selectedProjectId: firstProject?.id ?? "",
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    restoreTerminalVisibleOnGitOpsClose: false,
    takeoverVisible: false,
    takeoverOverrides: {},
    gitOpsReturnView: "code",
    selectedDiffTurnCount: null,
    selectedDiffFilePath: null,
    settingsOpen: false,
    settingsPanelOpen: false,
    archivedThreadsOpen: false,
    collapsedProjectIds: Object.fromEntries(
      projects.map((project) => [project.id, project.collapsed ?? true]),
    ),
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "sync-projects": {
      const hasSelectedProject = action.projects.some(
        (project) => project.id === state.selectedProjectId,
      );
      const selectedProjectId = hasSelectedProject
        ? state.selectedProjectId
        : action.projects[0]?.id || "";

      const collapsedProjectIds = Object.fromEntries(
        action.projects.map((project) => [
          project.id,
          state.collapsedProjectIds[project.id] ?? project.collapsed ?? true,
        ]),
      );

      const nextActiveView =
        hasSelectedProject || !state.selectedProjectId || action.projects.length === 0
          ? state.activeView
          : "code";

      return {
        ...state,
        ...getTerminalStateForNextView(state, nextActiveView),
        activeView: nextActiveView,
        selectedProjectId,
        selectedThreadId:
          hasSelectedProject || !state.selectedProjectId ? state.selectedThreadId : null,
        selectedSessionPath:
          hasSelectedProject || !state.selectedProjectId ? state.selectedSessionPath : null,
        selectedDiffTurnCount:
          hasSelectedProject || !state.selectedProjectId ? state.selectedDiffTurnCount : null,
        selectedDiffFilePath:
          hasSelectedProject || !state.selectedProjectId ? state.selectedDiffFilePath : null,
        gitOpsReturnView:
          hasSelectedProject || !state.selectedProjectId ? state.gitOpsReturnView : "code",
        collapsedProjectIds,
      };
    }
    case "show-view":
      return {
        ...state,
        ...getTerminalStateForNextView(state, action.view),
        activeView: action.view,
        selectedThreadId: action.view === "thread" ? state.selectedThreadId : null,
        selectedSessionPath: action.view === "thread" ? state.selectedSessionPath : null,
        selectedDiffTurnCount: action.view === "thread" ? state.selectedDiffTurnCount : null,
        selectedDiffFilePath: action.view === "thread" ? state.selectedDiffFilePath : null,
        takeoverVisible: action.view === "thread" ? state.takeoverVisible : false,
      };
    case "select-inbox-thread":
      return {
        ...state,
        selectedInboxSessionPath: action.sessionPath,
      };
    case "select-project":
      return {
        ...state,
        ...getTerminalStateForNextView(state, "code"),
        activeView: "code",
        selectedProjectId: action.projectId,
        selectedThreadId: null,
        selectedSessionPath: null,
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
        takeoverVisible: false,
        gitOpsReturnView: "code",
      };
    case "set-selected-project":
      return {
        ...state,
        selectedProjectId: action.projectId,
      };
    case "open-thread":
      return {
        ...state,
        ...getTerminalStateForNextView(state, "thread"),
        activeView: "thread",
        selectedProjectId: action.projectId,
        selectedThreadId: action.threadId,
        selectedSessionPath: action.sessionPath,
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
        gitOpsReturnView: "thread",
        collapsedProjectIds: {
          ...state.collapsedProjectIds,
          [action.projectId]: false,
        },
      };
    case "open-gitops":
      return {
        ...state,
        activeView: "gitops",
        terminalVisible: false,
        restoreTerminalVisibleOnGitOpsClose:
          state.activeView === "gitops"
            ? state.restoreTerminalVisibleOnGitOpsClose
            : state.activeView === "thread" && state.terminalVisible,
        takeoverVisible: false,
        gitOpsReturnView:
          action.returnView ?? getGitOpsReturnView(state.activeView, state.gitOpsReturnView),
        selectedDiffTurnCount: action.checkpointTurnCount,
        selectedDiffFilePath: action.filePath ?? null,
      };
    case "close-gitops":
      return {
        ...state,
        ...getTerminalStateForNextView(state, state.gitOpsReturnView),
        activeView: state.gitOpsReturnView,
        selectedThreadId: state.gitOpsReturnView === "thread" ? state.selectedThreadId : null,
        selectedSessionPath: state.gitOpsReturnView === "thread" ? state.selectedSessionPath : null,
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
      };
    case "toggle-terminal":
      return { ...state, terminalVisible: !state.terminalVisible };
    case "set-terminal-visible":
      return { ...state, terminalVisible: action.visible };
    case "show-takeover":
      return { ...state, takeoverVisible: true };
    case "hide-takeover":
      return { ...state, takeoverVisible: false };
    case "set-takeover-visible":
      return { ...state, takeoverVisible: action.visible };
    case "set-session-takeover-override": {
      if (action.visible === null) {
        const { [action.sessionPath]: _removedOverride, ...remainingOverrides } =
          state.takeoverOverrides;
        return {
          ...state,
          takeoverOverrides: remainingOverrides,
        };
      }

      return {
        ...state,
        takeoverOverrides: {
          ...state.takeoverOverrides,
          [action.sessionPath]: action.visible,
        },
      };
    }
    case "set-diff-turn":
      return {
        ...state,
        selectedDiffTurnCount: action.checkpointTurnCount,
        selectedDiffFilePath: null,
      };
    case "toggle-settings":
      return { ...state, settingsOpen: !state.settingsOpen };
    case "set-settings-panel-open":
      return {
        ...state,
        settingsPanelOpen: action.open,
        settingsOpen: action.open ? false : state.settingsOpen,
        archivedThreadsOpen: action.open ? false : state.archivedThreadsOpen,
      };
    case "set-archived-threads-open":
      return {
        ...state,
        archivedThreadsOpen: action.open,
        settingsOpen: action.open ? false : state.settingsOpen,
        settingsPanelOpen: action.open ? false : state.settingsPanelOpen,
      };
    case "toggle-project-collapse":
      return {
        ...state,
        collapsedProjectIds: {
          ...state.collapsedProjectIds,
          [action.projectId]: !state.collapsedProjectIds[action.projectId],
        },
      };
    case "collapse-all-projects":
      return {
        ...state,
        collapsedProjectIds: Object.fromEntries(
          Object.keys(state.collapsedProjectIds).map((projectId) => [projectId, true]),
        ),
      };
    default:
      return state;
  }
}

export function selectProject(projects: Project[], selectedProjectId: string): Project | undefined {
  return projects.find((project) => project.id === selectedProjectId) ?? projects[0];
}

export function selectThread(
  project: Project | undefined,
  selectedThreadId: string | null,
): Thread | undefined {
  if (!project || !selectedThreadId) {
    return undefined;
  }

  return project.threads.find((thread) => thread.id === selectedThreadId);
}

export function getCurrentTitle(activeView: View, selectedThread: Thread | undefined): string {
  if (activeView === "gitops") {
    return "Git ops";
  }

  return activeView === "thread" && selectedThread ? selectedThread.title : "New thread";
}

export function getProjectName(project: Project | undefined): string {
  return project?.name ?? "Pi";
}
