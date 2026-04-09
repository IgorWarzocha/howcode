import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import type { ArchivedThread, ComposerState, ProjectGitState, ShellState } from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import type { View } from "../types";
import { deriveControllerViewModel } from "./controller-view-model";
import { getProjectSelectionAction } from "./scoped-project-view";
import { useAppShellEffects } from "./useAppShellEffects";
import { useDesktopActionHandlers } from "./useDesktopActionHandlers";
import { useProjectRepoInspection } from "./useProjectRepoInspection";
import { useScopedProjectViewSync } from "./useScopedProjectViewSync";

export function useAppShellController() {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null);
  const [extensionsProjectScopeActive, setExtensionsProjectScopeActive] = useState(false);
  const [skillsProjectScopeActive, setSkillsProjectScopeActive] = useState(false);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0);
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

  const {
    handleAction,
    handleConfirmProjectAction,
    pendingProjectAction,
    runDesktopAction,
    setPendingProjectAction,
  } = useDesktopActionHandlers({
    activeView: state.activeView,
    composerProjectId,
    dispatch,
    invokeDesktopAction,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    loadProjectThreads,
    projects,
    refreshShellState,
    selectedSessionPath: state.selectedSessionPath,
    setArchivedThreads,
    setComposerState,
    setProjectGitState,
    workspaceState: state,
  });

  useProjectRepoInspection({
    projects,
    selectedProjectId: state.selectedProjectId,
    runDesktopAction,
  });

  useScopedProjectViewSync({
    activeView: state.activeView,
    extensionsProjectScopeActive,
    setExtensionsProjectScopeActive,
    setSkillsProjectScopeActive,
    skillsProjectScopeActive,
  });

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
    handleProjectSelect: (projectId: string) =>
      dispatch({
        type: getProjectSelectionAction(state.activeView),
        projectId,
      }),
    handleProjectReorder,
    handleSetSkillsProjectScopeActive: setSkillsProjectScopeActive,
    handleSelectDiffTurn,
    handleShowView,
    handleThreadOpen,
    handleShowTakeoverTerminal: () => dispatch({ type: "show-takeover" }),
    handleToggleDiff: handleToggleDiffPanel,
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: "toggle-settings" }),
    handleToggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
    handleToggleTerminal: () => dispatch({ type: "toggle-terminal" }),
    handleSetExtensionsProjectScopeActive: setExtensionsProjectScopeActive,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    pendingProjectAction,
    extensionsProjectScopeActive,
    projects,
    projectGitState,
    shellState,
    skillsProjectScopeActive,
    state,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
