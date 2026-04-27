import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import type { DesktopActionResult, InboxThread, ShellState } from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { View } from "../types";
import { getProjectSelectionAction } from "./scoped-project-view";

type RunDesktopAction = (
  action: "project.reorder",
  payload: { projectIds: string[] },
) => Promise<DesktopActionResult | null>;

type HandleAction = (
  action:
    | "threads.collapse-all"
    | "project.collapse"
    | "project.expand"
    | "thread.open"
    | "inbox.mark-read"
    | "inbox.dismiss"
    | "composer.reload-settings",
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>;

type UseAppShellCommandsInput = {
  applyProjectOrder: (projectIds: string[]) => void;
  collapsedProjectIds: Record<string, boolean>;
  composerProjectId: string;
  dispatch: Dispatch<WorkspaceAction>;
  handleAction: HandleAction;
  queryClient: QueryClient;
  runDesktopAction: RunDesktopAction;
  scheduleShellStateRefresh: () => void;
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>;
  setThreadRefreshKey: Dispatch<SetStateAction<number>>;
  shellState: ShellState | null;
  workspaceState: WorkspaceState;
};

function resetProjectDiffCaches(queryClient: QueryClient, projectId: string) {
  queryClient.removeQueries({
    queryKey: desktopQueryKeys.projectDiffPrefix(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  });
}

export function useAppShellCommands({
  applyProjectOrder,
  collapsedProjectIds,
  composerProjectId,
  dispatch,
  handleAction,
  queryClient,
  runDesktopAction,
  scheduleShellStateRefresh,
  setThreadHistoryCompactions,
  setThreadRefreshKey,
  shellState,
  workspaceState,
}: UseAppShellCommandsInput) {
  const handleShowView = (view: Exclude<View, "gitops">) => {
    dispatch({ type: "show-view", view });
  };

  const handleCloseUtilityView = () => {
    dispatch({ type: "close-utility-view" });
  };

  const handleCollapseAll = () => {
    dispatch({ type: "collapse-all-projects" });
    void handleAction("threads.collapse-all");
  };

  const handleToggleProjectCollapse = (projectId: string) => {
    const nextCollapsed = !collapsedProjectIds[projectId];
    dispatch({ type: "toggle-project-collapse", projectId });
    void handleAction(nextCollapsed ? "project.collapse" : "project.expand", { projectId });
  };

  const handleThreadOpen = (projectId: string, threadId: string, sessionPath: string) => {
    setThreadHistoryCompactions(0);
    dispatch({ type: "open-thread", projectId, threadId, sessionPath });
    void handleAction("thread.open", { projectId, threadId, sessionPath });
  };

  const handleSelectInboxThread = (thread: InboxThread) => {
    dispatch({ type: "select-inbox-thread", sessionPath: thread.sessionPath });

    if (thread.unread) {
      void handleAction("inbox.mark-read", {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
      });
    }
  };

  const handleDismissInboxThread = (thread: InboxThread) => {
    void handleAction("inbox.dismiss", {
      projectId: thread.projectId,
      sessionPath: thread.sessionPath,
    });
  };

  const handleLoadEarlierMessages = () => {
    setThreadHistoryCompactions((current) => current + 1);
  };

  const handleOpenGitOpsView = (options: { filePath?: string | null } = {}) => {
    if (composerProjectId) {
      resetProjectDiffCaches(queryClient, composerProjectId);
    }

    dispatch({ type: "open-gitops", filePath: options.filePath ?? null });
  };

  const handleCloseGitOpsView = () => {
    dispatch({ type: "close-gitops" });
  };

  const handleOpenWorktreeDiffFile = (filePath: string) => {
    handleOpenGitOpsView({ filePath });
  };

  const handleProjectReorder = async (projectIds: string[]) => {
    applyProjectOrder(projectIds);
    await runDesktopAction("project.reorder", { projectIds });
    scheduleShellStateRefresh();
  };

  const setTakeoverOverrideForSelectedSession = (visible: boolean) => {
    const sessionPath = workspaceState.selectedSessionPath;
    const globalTakeoverVisible = shellState?.appSettings?.piTuiTakeover;

    if (!sessionPath || typeof globalTakeoverVisible !== "boolean") {
      return;
    }

    dispatch({
      type: "set-session-takeover-override",
      sessionPath,
      visible: visible === globalTakeoverVisible ? null : visible,
    });
  };

  const handleShowTakeoverTerminal = () => {
    dispatch({ type: "set-takeover-visible", visible: true });
    setTakeoverOverrideForSelectedSession(true);
  };

  const closeTakeover = async ({
    preserveSessionOverride = false,
    refreshThread = true,
  }: {
    preserveSessionOverride?: boolean;
    refreshThread?: boolean;
  } = {}) => {
    dispatch({ type: "set-takeover-visible", visible: false });

    if (!preserveSessionOverride) {
      setTakeoverOverrideForSelectedSession(false);
    }

    if (refreshThread) {
      setThreadRefreshKey((current) => current + 1);
    }

    if (workspaceState.selectedSessionPath) {
      await handleAction("composer.reload-settings", {
        projectId: composerProjectId,
        sessionPath: workspaceState.selectedSessionPath,
      });
    }
  };

  const handleReturnToDesktopFromTakeover = () => {
    void closeTakeover();
  };

  return {
    handleCloseGitOpsView,
    handleCloseTakeoverTerminal: closeTakeover,
    handleCloseUtilityView,
    handleCollapseAll,
    handleDismissInboxThread,
    handleLoadEarlierMessages,
    handleOpenGitOpsView,
    handleOpenSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: true }),
    handleOpenWorktreeDiffFile,
    handleProjectReorder,
    handleProjectSelect: (projectId: string) =>
      dispatch({ type: getProjectSelectionAction(workspaceState.activeView), projectId }),
    handleReturnToDesktopFromTakeover,
    handleSelectInboxThread,
    handleShowTakeoverTerminal,
    handleShowView,
    handleThreadOpen,
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: "toggle-settings" }),
    handleToggleTerminal: () => dispatch({ type: "toggle-terminal" }),
    handleCloseSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: false }),
  };
}
