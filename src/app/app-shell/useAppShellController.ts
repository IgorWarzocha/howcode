import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import type { ArchivedThread, ComposerState, InboxThread, ProjectGitState } from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopInbox } from "../hooks/useDesktopInbox";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { useToast } from "../hooks/useToast";
import { desktopQueryKeys } from "../query/desktop-query";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import type { View } from "../types";
import { deriveControllerViewModel } from "./controller-view-model";
import { getProjectSelectionAction } from "./scoped-project-view";
import { useAppShellEffects } from "./useAppShellEffects";
import { useDesktopActionHandlers } from "./useDesktopActionHandlers";
import { useInboxAutoReadSync } from "./useInboxAutoReadSync";
import { useProjectRepoOriginRefresh } from "./useProjectRepoOriginRefresh";
import { useRunningTerminalSessions } from "./useRunningTerminalSessions";
import { useScopedProjectViewSync } from "./useScopedProjectViewSync";

export function useAppShellController() {
  const queryClient = useQueryClient();
  const [appLaunchedAtMs] = useState(() => Date.now());
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null);
  const [extensionsProjectScopeActive, setExtensionsProjectScopeActive] = useState(false);
  const [skillsProjectScopeActive, setSkillsProjectScopeActive] = useState(false);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0);
  const { toast, showToast } = useToast();
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
  const inboxQuery = useDesktopInbox();
  const inboxThreads = inboxQuery.data ?? [];
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find((thread) => thread.sessionPath === state.selectedInboxSessionPath) ?? null,
    [inboxThreads, state.selectedInboxSessionPath],
  );
  const { terminalRunningProjectIds, terminalRunningSessionPaths } = useRunningTerminalSessions();

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
    shellAppSettings: shellState?.appSettings,
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

  const { handleAction, runDesktopAction } = useDesktopActionHandlers({
    activeView: state.activeView,
    composerProjectId,
    dispatch,
    invokeDesktopAction,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    loadProjectThreads,
    refreshShellState,
    selectedSessionPath: state.selectedSessionPath,
    setArchivedThreads,
    setComposerState,
    setProjectGitState,
    showToast,
    workspaceState: state,
  });

  useProjectRepoOriginRefresh({
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

  const resetProjectDiffCaches = (projectId: string) => {
    queryClient.removeQueries({
      queryKey: desktopQueryKeys.projectDiffPrefix(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
    });
  };

  useInboxAutoReadSync({
    dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    workspaceState: state,
  });

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
      resetProjectDiffCaches(composerProjectId);
    }

    dispatch({
      type: "open-gitops",
      filePath: options.filePath ?? null,
    });
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
    const sessionPath = state.selectedSessionPath;
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

  const closeTakeover = ({
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
  };

  const handleReturnToDesktopFromTakeover = () => {
    void closeTakeover();
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
    handleCollapseAll,
    handleOpenSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: true }),
    handleCloseSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: false }),
    handleCloseTakeoverTerminal: closeTakeover,
    handleCloseGitOpsView,
    handleCloseUtilityView,
    handleOpenWorktreeDiffFile,
    handleLoadEarlierMessages,
    handleDismissInboxThread,
    inboxThreads,
    handleProjectSelect: (projectId: string) =>
      dispatch({
        type: getProjectSelectionAction(state.activeView),
        projectId,
      }),
    handleProjectReorder,
    handleSetSkillsProjectScopeActive: setSkillsProjectScopeActive,
    handleShowView,
    handleSelectInboxThread,
    handleThreadOpen,
    handleShowTakeoverTerminal,
    handleReturnToDesktopFromTakeover,
    handleOpenGitOpsView,
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: "toggle-settings" }),
    handleToggleTerminal: () => dispatch({ type: "toggle-terminal" }),
    handleSetExtensionsProjectScopeActive: setExtensionsProjectScopeActive,
    handleLoadProjectThreads: loadProjectThreads,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    extensionsProjectScopeActive,
    appLaunchedAtMs,
    projects,
    projectGitState,
    shellState,
    skillsProjectScopeActive,
    state,
    selectedInboxThread,
    terminalRunningProjectIds,
    terminalRunningSessionPaths,
    toast,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
