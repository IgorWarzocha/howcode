import { getPersistedSessionPath } from "../../../shared/session-paths";
import type { DesktopEvent } from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceState } from "../state/workspace";

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
};

export type DesktopEventSelectionState = Pick<
  WorkspaceState,
  "activeView" | "selectedSessionPath" | "selectedInboxSessionPath"
>;

export function getVisibleDesktopSessionPath(workspaceState: DesktopEventSelectionState) {
  return workspaceState.activeView === "thread" || workspaceState.activeView === "gitops"
    ? getPersistedSessionPath(workspaceState.selectedSessionPath)
    : workspaceState.activeView === "inbox"
      ? (workspaceState.selectedInboxSessionPath ?? null)
      : null;
}

export function shouldAutoOpenStartedThread(
  reason: Extract<DesktopEvent, { type: "thread-update" }>["reason"],
  workspaceState: DesktopEventSelectionState,
) {
  const visibleSessionPath = getVisibleDesktopSessionPath(workspaceState);

  return (
    reason === "start" &&
    (workspaceState.activeView === "code" ||
      (workspaceState.activeView === "thread" && visibleSessionPath === null))
  );
}

export async function refreshVisibleInboxThread({
  event,
  loadProjectThreads,
  queryClient,
}: {
  event: Extract<DesktopEvent, { type: "thread-update" }>;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  queryClient: QueryClientLike;
}) {
  await window.piDesktop?.invokeAction("inbox.mark-read", {
    sessionPath: event.sessionPath,
    projectId: event.projectId,
  });

  await Promise.all([
    loadProjectThreads(event.projectId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  ]);
}

export function invalidateProjectWorktreeQueries({
  activeView,
  projectId,
  queryClient,
}: {
  activeView: WorkspaceState["activeView"];
  projectId: string;
  queryClient: QueryClientLike;
}) {
  if (activeView === "gitops") {
    void queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffPrefix(projectId),
    });
  }

  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  });

  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  });
}
