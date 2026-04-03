import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import type { PendingProjectDialog } from "../components/sidebar/ProjectActionDialog";
import type { DesktopAction } from "../desktop/actions";
import type { ArchivedThread, ComposerState, ProjectGitState } from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import type { View } from "../types";
import {
  buildContextualActionPayload,
  buildPendingProjectAction,
  refreshArchivedThreadsIfOpen,
  refreshComposerState,
  shouldConfirmProjectAction,
} from "./controller-action-helpers";
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
    loadProjectGitState,
    loadProjectThreads,
    applyProjectOrder,
    pickComposerAttachments,
    refreshShellState,
    scheduleShellStateRefresh,
  } = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const projects = shellState?.projects ?? [];
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

  const runDesktopAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    const contextualPayload = buildContextualActionPayload({
      action,
      payload,
      composerProjectId,
      activeView: state.activeView,
      selectedSessionPath: state.selectedSessionPath,
    });

    await invokeDesktopAction(action, contextualPayload);

    if (action === "thread.pin" || action === "thread.archive") {
      const projectId =
        typeof contextualPayload.projectId === "string" ? contextualPayload.projectId : null;
      if (projectId) {
        await loadProjectThreads(projectId);
      }

      if (action === "thread.archive") {
        await refreshArchivedThreadsIfOpen({
          archivedThreadsOpen: state.archivedThreadsOpen,
          loadArchivedThreads,
          setArchivedThreads,
        });
      }

      if (action === "thread.archive" && contextualPayload.threadId === state.selectedThreadId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "thread.restore" || action === "thread.delete") {
      setArchivedThreads(await loadArchivedThreads());

      const projectId =
        typeof contextualPayload.projectId === "string" ? contextualPayload.projectId : null;
      if (projectId) {
        await loadProjectThreads(projectId);
      }

      if (action === "thread.delete" && contextualPayload.threadId === state.selectedThreadId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "project.edit-name") {
      await refreshShellState();
      await refreshArchivedThreadsIfOpen({
        archivedThreadsOpen: state.archivedThreadsOpen,
        loadArchivedThreads,
        setArchivedThreads,
      });
    }

    if (action === "project.archive-threads") {
      const projectId =
        typeof contextualPayload.projectId === "string" ? contextualPayload.projectId : null;

      if (projectId) {
        await loadProjectThreads(projectId);
      }

      await refreshShellState();
      await refreshArchivedThreadsIfOpen({
        archivedThreadsOpen: state.archivedThreadsOpen,
        loadArchivedThreads,
        setArchivedThreads,
      });

      if (contextualPayload.projectId === state.selectedProjectId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "project.remove-project") {
      if (contextualPayload.projectId === state.selectedProjectId) {
        dispatch({ type: "show-view", view: "home" });
      }

      await refreshShellState();
      await refreshArchivedThreadsIfOpen({
        archivedThreadsOpen: state.archivedThreadsOpen,
        loadArchivedThreads,
        setArchivedThreads,
      });
    }

    if (action === "composer.model" || action === "composer.thinking") {
      await refreshComposerState({
        composerProjectId,
        activeView: state.activeView,
        selectedSessionPath: state.selectedSessionPath,
        loadComposerState,
        setComposerState,
      });
    }

    if (action === "thread.new") {
      dispatch({ type: "show-view", view: "home" });

      const nextComposerState = await loadComposerState({ projectId: composerProjectId });
      if (nextComposerState) {
        setComposerState(nextComposerState);
      }
    }
  };

  const handleAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    if (shouldConfirmProjectAction(action)) {
      const pendingAction = buildPendingProjectAction(action, payload, projects);
      if (!pendingAction) {
        return;
      }

      setPendingProjectAction(pendingAction);
      return;
    }

    await runDesktopAction(action, payload);
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
    handleConfirmProjectAction,
    handleCloseProjectActionDialog: () => setPendingProjectAction(null),
    handleCloseTakeoverTerminal: () => {
      dispatch({ type: "hide-takeover" });
      setThreadRefreshKey((current) => current + 1);
      void refreshShellState();
    },
    handleOpenDiffSelection,
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
    pickComposerAttachments,
    pendingProjectAction,
    projects,
    projectGitState,
    shellState,
    state,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
