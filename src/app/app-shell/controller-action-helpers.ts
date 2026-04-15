import type { DesktopAction } from "../desktop/actions";
import type { AnyDesktopActionPayload, ArchivedThread } from "../desktop/types";
import type { WorkspaceState } from "../state/workspace";

export function buildContextualActionPayload({
  action,
  payload,
  composerProjectId,
  activeView,
  selectedSessionPath,
}: {
  action: DesktopAction;
  payload: AnyDesktopActionPayload;
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
        sessionPath:
          activeView === "thread" || activeView === "gitops" ? selectedSessionPath : null,
        ...payload,
      }
    : payload;
}

export async function refreshArchivedThreadsIfOpen({
  archivedThreadsVisible,
  loadArchivedThreads,
  setArchivedThreads,
}: {
  archivedThreadsVisible: boolean;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  setArchivedThreads: (threads: ArchivedThread[]) => void;
}) {
  if (!archivedThreadsVisible) {
    return;
  }

  setArchivedThreads(await loadArchivedThreads());
}
