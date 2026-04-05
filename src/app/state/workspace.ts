import type { Project, Thread, View } from "../types";

export type WorkspaceState = {
  activeView: View;
  selectedProjectId: string;
  selectedThreadId: string | null;
  selectedSessionPath: string | null;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  takeoverVisible: boolean;
  diffVisible: boolean;
  selectedDiffTurnCount: number | null;
  selectedDiffFilePath: string | null;
  settingsOpen: boolean;
  settingsPanelOpen: boolean;
  archivedThreadsOpen: boolean;
  collapsedProjectIds: Record<string, boolean>;
};

export type WorkspaceAction =
  | { type: "sync-projects"; projects: Project[] }
  | { type: "show-view"; view: View }
  | { type: "select-project"; projectId: string }
  | { type: "open-thread"; projectId: string; threadId: string; sessionPath: string }
  | { type: "toggle-sidebar" }
  | { type: "toggle-terminal" }
  | { type: "show-takeover" }
  | { type: "hide-takeover" }
  | { type: "toggle-diff" }
  | { type: "open-diff"; checkpointTurnCount: number | null; filePath?: string | null }
  | { type: "set-diff-turn"; checkpointTurnCount: number | null }
  | { type: "toggle-settings" }
  | { type: "set-settings-panel-open"; open: boolean }
  | { type: "set-archived-threads-open"; open: boolean }
  | { type: "toggle-project-collapse"; projectId: string }
  | { type: "collapse-all-projects" };

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  const [firstProject] = projects;

  return {
    activeView: "code",
    selectedProjectId: firstProject?.id ?? "",
    selectedThreadId: null,
    selectedSessionPath: null,
    sidebarVisible: true,
    terminalVisible: false,
    takeoverVisible: false,
    diffVisible: false,
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

      return {
        ...state,
        activeView:
          hasSelectedProject || !state.selectedProjectId || action.projects.length === 0
            ? state.activeView
            : "code",
        selectedProjectId,
        selectedThreadId:
          hasSelectedProject || !state.selectedProjectId ? state.selectedThreadId : null,
        selectedSessionPath:
          hasSelectedProject || !state.selectedProjectId ? state.selectedSessionPath : null,
        selectedDiffTurnCount:
          hasSelectedProject || !state.selectedProjectId ? state.selectedDiffTurnCount : null,
        selectedDiffFilePath:
          hasSelectedProject || !state.selectedProjectId ? state.selectedDiffFilePath : null,
        collapsedProjectIds,
      };
    }
    case "show-view":
      return {
        ...state,
        activeView: action.view,
        selectedThreadId: action.view === "thread" ? state.selectedThreadId : null,
        selectedSessionPath: action.view === "thread" ? state.selectedSessionPath : null,
        selectedDiffTurnCount: action.view === "thread" ? state.selectedDiffTurnCount : null,
        selectedDiffFilePath: action.view === "thread" ? state.selectedDiffFilePath : null,
      };
    case "select-project":
      return {
        ...state,
        activeView: "code",
        selectedProjectId: action.projectId,
        selectedThreadId: null,
        selectedSessionPath: null,
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
      };
    case "open-thread":
      return {
        ...state,
        activeView: "thread",
        selectedProjectId: action.projectId,
        selectedThreadId: action.threadId,
        selectedSessionPath: action.sessionPath,
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
        collapsedProjectIds: {
          ...state.collapsedProjectIds,
          [action.projectId]: false,
        },
      };
    case "toggle-sidebar":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "toggle-terminal":
      return { ...state, terminalVisible: !state.terminalVisible };
    case "show-takeover":
      return { ...state, takeoverVisible: true };
    case "hide-takeover":
      return { ...state, takeoverVisible: false };
    case "toggle-diff":
      return { ...state, diffVisible: !state.diffVisible };
    case "open-diff":
      return {
        ...state,
        diffVisible: true,
        selectedDiffTurnCount: action.checkpointTurnCount,
        selectedDiffFilePath: action.filePath ?? null,
      };
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
  return activeView === "thread" && selectedThread ? selectedThread.title : "New thread";
}

export function getProjectName(project: Project | undefined): string {
  return project?.name ?? "Pi";
}
