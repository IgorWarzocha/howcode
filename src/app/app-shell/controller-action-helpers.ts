import type { PendingProjectDialog } from "../components/sidebar/ProjectActionDialog";
import type { DesktopAction } from "../desktop/actions";
import type { ArchivedThread } from "../desktop/types";
import type { WorkspaceState } from "../state/workspace";
import type { Project } from "../types";

export function buildContextualActionPayload({
  action,
  payload,
  composerProjectId,
  activeView,
  selectedSessionPath,
}: {
  action: DesktopAction;
  payload: Record<string, unknown>;
  composerProjectId: string;
  activeView: WorkspaceState["activeView"];
  selectedSessionPath: string | null;
}) {
  return action === "composer.model" ||
    action === "composer.send" ||
    action === "composer.thinking" ||
    action === "workspace.commit" ||
    action === "workspace.commit-options"
    ? {
        projectId: composerProjectId,
        sessionPath: activeView === "thread" ? selectedSessionPath : null,
        ...payload,
      }
    : payload;
}

export function shouldConfirmProjectAction(action: DesktopAction) {
  return action === "project.archive-threads" || action === "project.remove-project";
}

export function buildPendingProjectAction(
  action: Extract<DesktopAction, "project.archive-threads" | "project.remove-project">,
  payload: Record<string, unknown>,
  projects: Project[],
): PendingProjectDialog | null {
  const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
  if (!projectId) {
    return null;
  }

  const resolvedProject = projects.find((project) => project.id === projectId);
  const projectName =
    typeof payload.projectName === "string" && payload.projectName.trim().length > 0
      ? payload.projectName.trim()
      : (resolvedProject?.name ?? projectId);

  return {
    action,
    projectId,
    projectName,
  };
}

export async function refreshArchivedThreadsIfOpen({
  archivedThreadsOpen,
  loadArchivedThreads,
  setArchivedThreads,
}: {
  archivedThreadsOpen: boolean;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  setArchivedThreads: (threads: ArchivedThread[]) => void;
}) {
  if (!archivedThreadsOpen) {
    return;
  }

  setArchivedThreads(await loadArchivedThreads());
}
