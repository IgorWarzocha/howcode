import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import type { PendingProjectDialog } from "../components/sidebar/ProjectActionDialog";
import type { DesktopAction } from "../desktop/actions";
import type {
  ArchivedThread,
  ComposerState,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
} from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import type { View } from "../types";
import {
  buildContextualActionPayload,
  buildPendingProjectAction,
  refreshArchivedThreadsIfOpen,
  shouldConfirmProjectAction,
} from "./controller-action-helpers";
import {
  applyOptimisticSettingsUpdate,
  runPostDesktopActionEffects,
} from "./controller-post-action-effects";
import { deriveControllerViewModel } from "./controller-view-model";
import { useAppShellEffects } from "./useAppShellEffects";

export function useAppShellController() {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0);
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectDialog | null>(
    null,
  );
  const {
    shellState,
    loadArchivedThreads,
    loadComposerState,
    listComposerAttachmentEntries,
    loadProjectGitState,
    loadProjectThreads,
    applyProjectOrder,
    pickComposerAttachments,
    refreshShellState,
    scheduleShellStateRefresh,
  } = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const shellProjects = shellState?.projects ?? [];
  const projects = useMemo(() => {
    const shellCwd = shellState?.cwd ?? null;

    if (!shellCwd || shellProjects.length <= 1) {
      return shellProjects;
    }

    return shellProjects.filter((project) => project.id !== shellCwd);
  }, [shellProjects, shellState?.cwd]);
  const threadData = useDesktopThread(
    state.selectedSessionPath,
    threadRefreshKey,
    threadHistoryCompactions,
  );

  const {
    activeComposerState,
    activeThreadData,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
  } = useMemo(
    () =>
      deriveControllerViewModel({
        projects,
        workspaceState: state,
        threadData,
        shellCwd: shellState?.cwd,
        composerState,
        shellComposerState: shellState?.composer,
      }),
    [composerState, projects, shellState?.composer, shellState?.cwd, state, threadData],
  );

  useAppShellEffects({
    projects,
    collapsedProjectIds,
    workspaceState: state,
    composerProjectId,
    shellComposerState: shellState?.composer,
    loadProjectThreads,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    scheduleShellStateRefresh,
    queryClient,
    dispatch,
    setArchivedThreads,
    setComposerState,
    setProjectGitState,
  });

  const runDesktopAction = async (
    action: DesktopAction,
    payload: Record<string, unknown> = {},
  ): Promise<DesktopActionResult | null> => {
    const contextualPayload = buildContextualActionPayload({
      action,
      payload,
      composerProjectId,
      activeView: state.activeView,
      selectedSessionPath: state.selectedSessionPath,
    });

    const actionResult = await invokeDesktopAction(action, contextualPayload);

    await runPostDesktopActionEffects({
      action,
      contextualPayload,
      actionResult,
      workspaceState: state,
      composerProjectId,
      dispatch,
      loadArchivedThreads,
      loadComposerState,
      loadProjectGitState,
      loadProjectThreads,
      refreshShellState,
      setArchivedThreads,
      setComposerState,
      setProjectGitState,
    });

    return actionResult;
  };

  const handleAction = async (
    action: DesktopAction,
    payload: Record<string, unknown> = {},
  ): Promise<DesktopActionResult | null> => {
    if (shouldConfirmProjectAction(action)) {
      const pendingAction = buildPendingProjectAction(action, payload, projects);
      if (!pendingAction) {
        return null;
      }

      setPendingProjectAction(pendingAction);
      return null;
    }

    if (action === "settings.update") {
      applyOptimisticSettingsUpdate(queryClient, payload);
    }

    return await runDesktopAction(action, payload);
  };

  const handleConfirmProjectAction = async (payload: Record<string, unknown> = {}) => {
    if (!pendingProjectAction) {
      return;
    }

    const nextAction = pendingProjectAction;
    setPendingProjectAction(null);

    await runDesktopAction(nextAction.action, {
      projectId: nextAction.projectId,
      projectName: nextAction.projectName,
      ...payload,
    });
  };

  const handleShowView = (view: View) => {
    dispatch({ type: "show-view", view });
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

  const handleLoadEarlierMessages = () => {
    setThreadHistoryCompactions((current) => current + 1);
  };

  const handleOpenDiffSelection = (checkpointTurnCount: number, filePath?: string) => {
    dispatch({
      type: "open-diff",
      checkpointTurnCount,
      filePath: filePath ?? null,
    });
  };

  const handleOpenWorktreeDiffFile = (filePath: string) => {
    dispatch({
      type: "open-diff",
      checkpointTurnCount: null,
      filePath,
    });
  };

  const handleSelectDiffTurn = (checkpointTurnCount: number | null) => {
    dispatch({ type: "set-diff-turn", checkpointTurnCount });
  };

  const handleToggleDiffPanel = () => {
    if (!state.diffVisible) {
      dispatch({
        type: "open-diff",
        checkpointTurnCount: null,
        filePath: null,
      });
      return;
    }

    dispatch({ type: "toggle-diff" });
  };

  const handleProjectReorder = async (projectIds: string[]) => {
    applyProjectOrder(projectIds);
    await runDesktopAction("project.reorder", { projectIds });
    scheduleShellStateRefresh();
  };

  return {
    activeComposerState,
    activeThreadData,
    archivedThreads,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
    handleAction,
    handleCloseArchivedThreads: () => dispatch({ type: "set-archived-threads-open", open: false }),
    handleCollapseAll,
    handleOpenArchivedThreads: () => dispatch({ type: "set-archived-threads-open", open: true }),
    handleOpenSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: true }),
    handleConfirmProjectAction,
    handleCloseProjectActionDialog: () => setPendingProjectAction(null),
    handleCloseSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: false }),
    handleCloseTakeoverTerminal: () => {
      dispatch({ type: "hide-takeover" });
      setThreadRefreshKey((current) => current + 1);
      void refreshShellState();
    },
    handleOpenDiffSelection,
    handleOpenWorktreeDiffFile,
    handleLoadEarlierMessages,
    handleProjectSelect: (projectId: string) => dispatch({ type: "select-project", projectId }),
    handleProjectReorder,
    handleSelectDiffTurn,
    handleShowView,
    handleThreadOpen,
    handleShowTakeoverTerminal: () => dispatch({ type: "show-takeover" }),
    handleToggleDiff: handleToggleDiffPanel,
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: "toggle-settings" }),
    handleToggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
    handleToggleTerminal: () => dispatch({ type: "toggle-terminal" }),
    listComposerAttachmentEntries,
    pickComposerAttachments,
    pendingProjectAction,
    projects,
    projectGitState,
    shellState,
    state,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
