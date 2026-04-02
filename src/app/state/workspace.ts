import type { Project, Thread, View } from "../types";

export type WorkspaceState = {
  activeView: View;
  selectedProjectId: string;
  selectedThreadId: string | null;
  selectedSessionPath: string | null;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  diffVisible: boolean;
  settingsOpen: boolean;
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
  | { type: "toggle-diff" }
  | { type: "toggle-settings" }
  | { type: "set-archived-threads-open"; open: boolean }
  | { type: "toggle-project-collapse"; projectId: string }
  | { type: "collapse-all-projects" };

// The collapsed map is derived once from project metadata so the tree interaction
// stays deterministic even before we add persisted desktop state.
export function createInitialWorkspaceState(projects: Project[]): WorkspaceState {
  const [firstProject] = projects;

  return {
    activeView: "home",
    selectedProjectId: firstProject?.id ?? "",
    selectedThreadId: null,
    selectedSessionPath: null,
    sidebarVisible: true,
    terminalVisible: false,
    diffVisible: false,
    settingsOpen: false,
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
            : "home",
        selectedProjectId,
        selectedThreadId:
          hasSelectedProject || !state.selectedProjectId ? state.selectedThreadId : null,
        selectedSessionPath:
          hasSelectedProject || !state.selectedProjectId ? state.selectedSessionPath : null,
        collapsedProjectIds,
      };
    }
    case "show-view":
      return {
        ...state,
        activeView: action.view,
        selectedThreadId: action.view === "thread" ? state.selectedThreadId : null,
        selectedSessionPath: action.view === "thread" ? state.selectedSessionPath : null,
      };
    case "select-project":
      return {
        ...state,
        activeView: "home",
        selectedProjectId: action.projectId,
        selectedThreadId: null,
        selectedSessionPath: null,
      };
    case "open-thread":
      return {
        ...state,
        activeView: "thread",
        selectedProjectId: action.projectId,
        selectedThreadId: action.threadId,
        selectedSessionPath: action.sessionPath,
        collapsedProjectIds: {
          ...state.collapsedProjectIds,
          [action.projectId]: false,
        },
      };
    case "toggle-sidebar":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "toggle-terminal":
      return { ...state, terminalVisible: !state.terminalVisible };
    case "toggle-diff":
      return { ...state, diffVisible: !state.diffVisible };
    case "toggle-settings":
      return { ...state, settingsOpen: !state.settingsOpen };
    case "set-archived-threads-open":
      return {
        ...state,
        archivedThreadsOpen: action.open,
        settingsOpen: action.open ? false : state.settingsOpen,
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
