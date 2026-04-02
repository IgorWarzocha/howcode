import { useEffect, useMemo, useReducer, useState } from "react";
import { ArchivedThreadsPanel } from "./components/settings/ArchivedThreadsPanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Composer } from "./components/workspace/Composer";
import { DiffPanel } from "./components/workspace/DiffPanel";
import { TerminalPanel } from "./components/workspace/TerminalPanel";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader";
import type { DesktopAction } from "./desktop/actions";
import type { ArchivedThread, ComposerState, DesktopEvent, ThreadData } from "./desktop/types";
import { useDesktopBridge } from "./hooks/useDesktopBridge";
import { useDesktopShell } from "./hooks/useDesktopShell";
import { useDesktopThread } from "./hooks/useDesktopThread";
import {
  createInitialWorkspaceState,
  getProjectName,
  selectProject,
  selectThread,
  workspaceReducer,
} from "./state/workspace";
import type { View } from "./types";
import { mainPanelClass } from "./ui/classes";
import { MainView } from "./views/MainView";

export function AppShell() {
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [liveThreads, setLiveThreads] = useState<Record<string, ThreadData>>({});
  const {
    shellState,
    loadArchivedThreads,
    loadComposerState,
    loadProjectThreads,
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
        void refreshShellState();
      }

      if (event.reason === "start" || event.reason === "end") {
        void loadProjectThreads(event.projectId);
      }

      if (event.reason === "end") {
        void refreshShellState();
      }
    });

    return unsubscribe;
  }, [loadProjectThreads, refreshShellState]);

  const handleAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
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

    if (action === "composer.model" || action === "composer.thinking") {
      const nextComposerState = await loadComposerState({
        projectId: composerProjectId,
        sessionPath: state.activeView === "thread" ? state.selectedSessionPath : null,
      });

      if (nextComposerState) {
        setComposerState(nextComposerState);
      }
    }
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

  const handleOpenArchivedThreads = () => {
    dispatch({ type: "set-archived-threads-open", open: true });
  };

  const handleCloseArchivedThreads = () => {
    dispatch({ type: "set-archived-threads-open", open: false });
  };

  return (
    <>
      <div
        className={
          state.sidebarVisible
            ? "grid h-screen grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)] max-md:grid-cols-1 max-xl:grid-cols-[300px_minmax(0,1fr)]"
            : "grid h-screen grid-cols-[minmax(0,1fr)] overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)]"
        }
      >
        <Sidebar
          projects={projects}
          activeView={state.activeView}
          selectedProjectId={state.selectedProjectId}
          selectedThreadId={state.selectedThreadId}
          sidebarVisible={state.sidebarVisible}
          settingsOpen={state.settingsOpen}
          collapsedProjectIds={collapsedProjectIds}
          onAction={(action, payload) => void handleAction(action, payload)}
          onShowView={handleShowView}
          onToggleSidebar={() => dispatch({ type: "toggle-sidebar" })}
          onToggleSettings={() => dispatch({ type: "toggle-settings" })}
          onOpenArchivedThreads={handleOpenArchivedThreads}
          onCollapseAll={handleCollapseAll}
          onProjectSelect={(projectId) => dispatch({ type: "select-project", projectId })}
          onThreadOpen={handleThreadOpen}
          onToggleProjectCollapse={handleToggleProjectCollapse}
        />

        <section className="flex min-w-0 min-h-0 flex-col overflow-hidden bg-[color:var(--workspace)]">
          <WorkspaceHeader
            activeView={state.activeView}
            currentTitle={currentTitle}
            currentProjectName={currentProjectName}
            sidebarVisible={state.sidebarVisible}
            terminalVisible={state.terminalVisible}
            diffVisible={state.diffVisible}
            onAction={(action, payload) => void handleAction(action, payload)}
            onToggleTerminal={() => dispatch({ type: "toggle-terminal" })}
            onToggleDiff={() => dispatch({ type: "toggle-diff" })}
          />

          <div
            className={
              state.diffVisible
                ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3 overflow-hidden px-5 max-xl:grid-cols-1"
                : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5"
            }
          >
            <main className={mainPanelClass}>
              <MainView
                activeView={state.activeView}
                currentProjectName={currentProjectName}
                threadData={activeThreadData}
                onAction={(action, payload) => void handleAction(action, payload)}
              />
            </main>
            {state.diffVisible ? (
              <div className="max-xl:hidden">
                <DiffPanel onAction={(action, payload) => void handleAction(action, payload)} />
              </div>
            ) : null}
          </div>

          <footer className="shrink-0 grid gap-2.5 px-5 pt-0 pb-4">
            <div className="mx-auto w-full max-w-[744px]">
              <Composer
                activeView={state.activeView}
                hostLabel={shellState?.availableHosts[0] ?? "Local"}
                profileLabel={shellState?.composerProfiles[0] ?? "Pi session"}
                model={activeComposerState?.currentModel ?? null}
                availableModels={activeComposerState?.availableModels ?? []}
                thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                projectId={composerProjectId}
                sessionPath={state.activeView === "thread" ? state.selectedSessionPath : null}
                onAction={handleAction}
              />
            </div>
            {state.terminalVisible ? (
              <div className="mx-auto w-full max-w-[744px]">
                <TerminalPanel onAction={(action, payload) => void handleAction(action, payload)} />
              </div>
            ) : null}
          </footer>
        </section>
      </div>

      <ArchivedThreadsPanel
        open={state.archivedThreadsOpen}
        threads={archivedThreads}
        onClose={handleCloseArchivedThreads}
        onAction={(action, payload) => void handleAction(action, payload)}
      />
    </>
  );
}
