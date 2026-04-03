import type { ThreadData } from "../desktop/types";
import { getProjectName, selectProject, selectThread } from "../state/workspace";
import type { WorkspaceState } from "../state/workspace";
import type { Project, Thread } from "../types";

type DeriveControllerViewModelInput = {
  projects: Project[];
  workspaceState: WorkspaceState;
  threadData: ThreadData | null;
  shellCwd: string | null | undefined;
  composerState: import("../desktop/types").ComposerState | null;
  shellComposerState: import("../desktop/types").ComposerState | null | undefined;
};

type ControllerViewModel = {
  collapsedProjectIds: Record<string, boolean>;
  selectedProject: Project | undefined;
  selectedThread: Thread | undefined;
  activeThreadData: ThreadData | null;
  currentTitle: string;
  currentProjectName: string;
  composerProjectId: string;
  activeComposerState: import("../desktop/types").ComposerState | null;
};

function buildFallbackThreadData(
  sessionPath: string,
  selectedThread: Thread | undefined,
): ThreadData {
  return {
    sessionPath,
    title: selectedThread?.title ?? "New thread",
    messages: [],
    previousMessageCount: 0,
    isStreaming: false,
    turnDiffSummaries: [],
  };
}

export function deriveControllerViewModel({
  projects,
  workspaceState,
  threadData,
  shellCwd,
  composerState,
  shellComposerState,
}: DeriveControllerViewModelInput): ControllerViewModel {
  const collapsedProjectIds = Object.fromEntries(
    projects.map((project) => [
      project.id,
      workspaceState.collapsedProjectIds[project.id] ?? project.collapsed ?? true,
    ]),
  );
  const selectedProject = selectProject(projects, workspaceState.selectedProjectId);
  const selectedThread = selectThread(selectedProject, workspaceState.selectedThreadId);
  const activeThreadData = workspaceState.selectedSessionPath
    ? (threadData ?? buildFallbackThreadData(workspaceState.selectedSessionPath, selectedThread))
    : null;

  return {
    collapsedProjectIds,
    selectedProject,
    selectedThread,
    activeThreadData,
    currentTitle:
      workspaceState.activeView === "thread"
        ? (activeThreadData?.title ?? selectedThread?.title ?? "New thread")
        : "New thread",
    currentProjectName: getProjectName(selectedProject),
    composerProjectId: selectedProject?.id ?? shellCwd ?? "",
    activeComposerState: composerState ?? shellComposerState ?? null,
  };
}
