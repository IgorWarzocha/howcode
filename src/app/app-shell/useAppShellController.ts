import { useEffect, useMemo, useReducer, useState } from "react";
import type { PendingProjectDialog } from "../components/sidebar/ProjectActionDialog";
import type { DesktopAction } from "../desktop/actions";
import type { ArchivedThread, ComposerState, DesktopEvent, ThreadData } from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import {
  createInitialWorkspaceState,
  getProjectName,
  selectProject,
  selectThread,
  workspaceReducer,
} from "../state/workspace";
import type { View } from "../types";

export function useAppShellController() {
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [liveThreads, setLiveThreads] = useState<Record<string, ThreadData>>({});
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectDialog | null>(
    null,
  );
  const {
    shellState,
    loadArchivedThreads,
    loadComposerState,
    loadProjectThreads,
    pickComposerAttachments,
    refreshShellState,
  } = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const projects = shellState?.projects ?? [];
  const collapsedProjectIds = useMemo(
    () =>
      Object.fromEntries(
        projects.map((project) => [
          project.id,
          state.collapsedProjectIds[project.id] ?? project.collapsed ?? true,
        ]),
      ),
    [projects, state.collapsedProjectIds],
  );

  const selectedProject = useMemo(
    () => selectProject(projects, state.selectedProjectId),
    [projects, state.selectedProjectId],
  );
  const selectedThread = useMemo(
    () => selectThread(selectedProject, state.selectedThreadId),
    [selectedProject, state.selectedThreadId],
  );
  const threadData = useDesktopThread(state.selectedSessionPath);
  const liveThreadData = state.selectedSessionPath ? liveThreads[state.selectedSessionPath] : null;
  const activeThreadData = state.selectedSessionPath
    ? (liveThreadData ??
      threadData ?? {
        sessionPath: state.selectedSessionPath,
        title: selectedThread?.title ?? "New thread",
        messages: [],
        previousMessageCount: 0,
        isStreaming: false,
      })
    : null;
  const currentTitle =
    state.activeView === "thread"
      ? (activeThreadData?.title ?? selectedThread?.title ?? "New thread")
      : "New thread";
  const currentProjectName = getProjectName(selectedProject);
  const composerProjectId = selectedProject?.id ?? shellState?.cwd ?? "";
  const activeComposerState = composerState ?? shellState?.composer ?? null;

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    dispatch({ type: "sync-projects", projects });
  }, [projects]);

  useEffect(() => {
    const expandedProjects = projects.filter(
      (project) => !collapsedProjectIds[project.id] && !project.threadsLoaded,
    );

    for (const project of expandedProjects) {
      void loadProjectThreads(project.id);
    }
  }, [collapsedProjectIds, loadProjectThreads, projects]);

  useEffect(() => {
    if (!state.archivedThreadsOpen) {
      return;
    }

    let cancelled = false;

    const loadArchived = async () => {
      const nextArchivedThreads = await loadArchivedThreads();
      if (!cancelled) {
        setArchivedThreads(nextArchivedThreads);
      }
    };

    void loadArchived();

    return () => {
      cancelled = true;
    };
  }, [loadArchivedThreads, state.archivedThreadsOpen]);

  useEffect(() => {
    if (!shellState?.composer) {
      return;
    }

    setComposerState((current) => current ?? shellState.composer);
  }, [shellState?.composer]);

  useEffect(() => {
    if (!composerProjectId) {
      return;
    }

    let cancelled = false;

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: composerProjectId,
        sessionPath: state.activeView === "thread" ? state.selectedSessionPath : null,
      });

      if (!cancelled && nextComposerState) {
        setComposerState(nextComposerState);
      }
    };

    void syncComposerState();

    return () => {
      cancelled = true;
    };
  }, [composerProjectId, loadComposerState, state.activeView, state.selectedSessionPath]);

  useEffect(() => {
    if (!window.piDesktop?.subscribe) {
      return;
    }

    const unsubscribe = window.piDesktop.subscribe((event: DesktopEvent) => {
      if (event.type === "composer-update") {
        setComposerState(event.composer);
        return;
      }

      setLiveThreads((current) => ({
        ...current,
        [event.sessionPath]: event.thread,
      }));
      setComposerState(event.composer);

      if (event.reason === "start") {
        dispatch({
          type: "open-thread",
          projectId: event.projectId,
          threadId: event.threadId,
          sessionPath: event.sessionPath,
        });
      }

      if (event.reason === "end") {
        void loadProjectThreads(event.projectId);
        void refreshShellState();
      }
    });

    return unsubscribe;
  }, [loadProjectThreads, refreshShellState]);

  const runDesktopAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    const contextualPayload =
      action === "composer.model" || action === "composer.send" || action === "composer.thinking"
        ? {
            projectId: composerProjectId,
            sessionPath: state.activeView === "thread" ? state.selectedSessionPath : null,
            ...payload,
          }
        : payload;

    await invokeDesktopAction(action, contextualPayload);

    if (action === "thread.pin" || action === "thread.archive") {
      const projectId =
        typeof contextualPayload.projectId === "string" ? contextualPayload.projectId : null;
      if (projectId) {
        await loadProjectThreads(projectId);
      }

      if (action === "thread.archive" && state.archivedThreadsOpen) {
        setArchivedThreads(await loadArchivedThreads());
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
      if (state.archivedThreadsOpen) {
        setArchivedThreads(await loadArchivedThreads());
      }
    }

    if (action === "project.archive-threads") {
      const projectId =
        typeof contextualPayload.projectId === "string" ? contextualPayload.projectId : null;

      if (projectId) {
        await loadProjectThreads(projectId);
      }

      await refreshShellState();

      if (state.archivedThreadsOpen) {
        setArchivedThreads(await loadArchivedThreads());
      }

      if (contextualPayload.projectId === state.selectedProjectId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "project.remove-project") {
      if (contextualPayload.projectId === state.selectedProjectId) {
        dispatch({ type: "show-view", view: "home" });
      }

      await refreshShellState();

      if (state.archivedThreadsOpen) {
        setArchivedThreads(await loadArchivedThreads());
      }
    }

    if (action === "composer.model" || action === "composer.thinking") {
      const nextComposerState = await loadComposerState({
        projectId: composerProjectId,
        sessionPath: state.activeView === "thread" ? state.selectedSessionPath : null,
      });

      if (nextComposerState) {
        setComposerState(nextComposerState);
      }
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
    if (
      action === "project.edit-name" ||
      action === "project.archive-threads" ||
      action === "project.remove-project"
    ) {
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (!projectId) {
        return;
      }

      const resolvedProject = projects.find((project) => project.id === projectId);
      const projectName =
        typeof payload.projectName === "string" && payload.projectName.trim().length > 0
          ? payload.projectName.trim()
          : (resolvedProject?.name ?? projectId);

      setPendingProjectAction({
        action,
        projectId,
        projectName,
      });
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
    dispatch({ type: "open-thread", projectId, threadId, sessionPath });
    void handleAction("thread.open", { projectId, threadId, sessionPath });
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
    handleProjectSelect: (projectId: string) => dispatch({ type: "select-project", projectId }),
    handleShowView,
    handleThreadOpen,
    handleToggleDiff: () => dispatch({ type: "toggle-diff" }),
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: "toggle-settings" }),
    handleToggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
    handleToggleTerminal: () => dispatch({ type: "toggle-terminal" }),
    pickComposerAttachments,
    pendingProjectAction,
    projects,
    shellState,
    state,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
