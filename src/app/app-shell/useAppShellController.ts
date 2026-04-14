import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  ArchivedThread,
  ComposerState,
  InboxThread,
  ProjectGitState,
  ShellState,
  TerminalSessionSnapshot,
} from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopInbox } from "../hooks/useDesktopInbox";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { listDesktopTerminals, subscribeDesktopTerminal } from "../hooks/useDesktopTerminal";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { desktopQueryKeys } from "../query/desktop-query";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import type { View } from "../types";
import { deriveControllerViewModel } from "./controller-view-model";
import { getProjectSelectionAction } from "./scoped-project-view";
import { useAppShellEffects } from "./useAppShellEffects";
import { useDesktopActionHandlers } from "./useDesktopActionHandlers";
import { useProjectRepoOriginRefresh } from "./useProjectRepoOriginRefresh";
import { useScopedProjectViewSync } from "./useScopedProjectViewSync";

export function useAppShellController() {
  const queryClient = useQueryClient();
  const terminalEventTouchedSessionIdsRef = useRef(new Set<string>());
  const [appLaunchedAtMs] = useState(() => Date.now());
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null);
  const [runningTerminalSessionsById, setRunningTerminalSessionsById] = useState<
    Record<string, { projectId: string; sessionPath: string | null }>
  >({});
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
  const inboxQuery = useDesktopInbox();
  const inboxThreads = inboxQuery.data ?? [];
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find((thread) => thread.sessionPath === state.selectedInboxSessionPath) ?? null,
    [inboxThreads, state.selectedInboxSessionPath],
  );
  const terminalRunningSessionPaths = useMemo(
    () =>
      new Set(
        Object.values(runningTerminalSessionsById)
          .map((session) => session.sessionPath)
          .filter((sessionPath): sessionPath is string => typeof sessionPath === "string"),
      ),
    [runningTerminalSessionsById],
  );
  const terminalRunningProjectIds = useMemo(
    () => new Set(Object.values(runningTerminalSessionsById).map((session) => session.projectId)),
    [runningTerminalSessionsById],
  );

  useEffect(() => {
    const applySnapshots = (snapshots: TerminalSessionSnapshot[]) => {
      const touchedSessionIds = terminalEventTouchedSessionIdsRef.current;

      setRunningTerminalSessionsById((current) => ({
        ...current,
        ...Object.fromEntries(
          snapshots
            .filter(
              (snapshot) =>
                snapshot.launchMode === "shell" &&
                (snapshot.status === "starting" || snapshot.status === "running") &&
                !touchedSessionIds.has(snapshot.sessionId),
            )
            .map((snapshot) => [
              snapshot.sessionId,
              {
                projectId: snapshot.projectId,
                sessionPath: snapshot.sessionPath,
              },
            ]),
        ),
      }));
    };

    void listDesktopTerminals().then((snapshots) => {
      applySnapshots(snapshots);
    });

    return subscribeDesktopTerminal((event) => {
      terminalEventTouchedSessionIdsRef.current.add(event.sessionId);

      if (event.type === "started" || event.type === "restarted") {
        if (event.snapshot.launchMode !== "shell") {
          return;
        }

        setRunningTerminalSessionsById((current) => ({
          ...current,
          [event.sessionId]: {
            projectId: event.snapshot.projectId,
            sessionPath: event.snapshot.sessionPath,
          },
        }));
        return;
      }

      if (event.type === "exited" || event.type === "error") {
        setRunningTerminalSessionsById((current) => {
          if (!(event.sessionId in current)) {
            return current;
          }

          const next = { ...current };
          delete next[event.sessionId];
          return next;
        });
      }
    });
  }, []);

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

  useEffect(() => {
    if (!inboxQuery.isSuccess) {
      return;
    }

    if (inboxThreads.length === 0) {
      if (state.selectedInboxSessionPath !== null) {
        dispatch({ type: "select-inbox-thread", sessionPath: null });
      }
      return;
    }

    const hasSelectedInboxThread = inboxThreads.some(
      (thread) => thread.sessionPath === state.selectedInboxSessionPath,
    );

    const selectedInboxThread = hasSelectedInboxThread
      ? (inboxThreads.find((thread) => thread.sessionPath === state.selectedInboxSessionPath) ??
        null)
      : null;

    if (!hasSelectedInboxThread) {
      const nextThread = inboxThreads[0] ?? null;

      dispatch({
        type: "select-inbox-thread",
        sessionPath: nextThread?.sessionPath ?? null,
      });

      if (state.activeView === "inbox" && nextThread?.unread) {
        void invokeDesktopAction("inbox.mark-read", {
          projectId: nextThread.projectId,
          sessionPath: nextThread.sessionPath,
        })
          .then(async () => {
            await Promise.all([
              loadProjectThreads(nextThread.projectId),
              queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
            ]);
          })
          .catch((error) => {
            console.warn("Failed to auto-mark selected inbox thread read.", error);
          });
      }

      return;
    }

    if (state.activeView === "inbox" && selectedInboxThread?.unread) {
      void invokeDesktopAction("inbox.mark-read", {
        projectId: selectedInboxThread.projectId,
        sessionPath: selectedInboxThread.sessionPath,
      })
        .then(async () => {
          await Promise.all([
            loadProjectThreads(selectedInboxThread.projectId),
            queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
          ]);
        })
        .catch((error) => {
          console.warn("Failed to mark visible inbox thread read.", error);
        });
    }
  }, [
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    state.activeView,
    state.selectedInboxSessionPath,
    inboxQuery.isSuccess,
  ]);

  const handleShowView = (view: Exclude<View, "gitops">) => {
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

  const handleOpenGitOpsView = (
    options: { checkpointTurnCount?: number | null; filePath?: string | null } = {},
  ) => {
    if (composerProjectId) {
      resetProjectDiffCaches(composerProjectId);
    }

    dispatch({
      type: "open-gitops",
      checkpointTurnCount: options.checkpointTurnCount ?? null,
      filePath: options.filePath ?? null,
    });
  };

  const handleCloseGitOpsView = () => {
    dispatch({ type: "close-gitops" });
  };

  const handleOpenDiffSelection = (checkpointTurnCount: number, filePath?: string) => {
    handleOpenGitOpsView({ checkpointTurnCount, filePath: filePath ?? null });
  };

  const handleOpenWorktreeDiffFile = (filePath: string) => {
    handleOpenGitOpsView({ checkpointTurnCount: null, filePath });
  };

  const handleSelectDiffTurn = (checkpointTurnCount: number | null) => {
    dispatch({ type: "set-diff-turn", checkpointTurnCount });
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
    handleCloseArchivedThreads: () => dispatch({ type: "set-archived-threads-open", open: false }),
    handleCollapseAll,
    handleOpenArchivedThreads: () => dispatch({ type: "set-archived-threads-open", open: true }),
    handleOpenSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: true }),
    handleConfirmProjectAction,
    handleCloseProjectActionDialog: () => setPendingProjectAction(null),
    handleCloseSettingsPanel: () => dispatch({ type: "set-settings-panel-open", open: false }),
    handleCloseTakeoverTerminal: closeTakeover,
    handleCloseGitOpsView,
    handleOpenDiffSelection,
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
    handleSelectDiffTurn,
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
    pendingProjectAction,
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
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
