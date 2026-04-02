import { useEffect, useMemo, useReducer, useState } from "react";
import { ArchivedThreadsPanel } from "./components/settings/ArchivedThreadsPanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Composer } from "./components/workspace/Composer";
import { DiffPanel } from "./components/workspace/DiffPanel";
import { TerminalPanel } from "./components/workspace/TerminalPanel";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader";
import type { DesktopAction } from "./desktop/actions";
import type { ArchivedThread } from "./desktop/types";
import { useDesktopBridge } from "./hooks/useDesktopBridge";
import { useDesktopShell } from "./hooks/useDesktopShell";
import { useDesktopThread } from "./hooks/useDesktopThread";
import {
  createInitialWorkspaceState,
  getCurrentTitle,
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
  const { shellState, loadArchivedThreads, loadProjectThreads, refreshShellState } =
    useDesktopShell();
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
  const threadData = useDesktopThread(selectedThread?.sessionPath);
  const activeThreadData = selectedThread?.sessionPath
    ? (threadData ?? {
        sessionPath: selectedThread.sessionPath,
        title: selectedThread.title,
        messages: [],
        previousMessageCount: 0,
      })
    : null;
  const currentTitle = getCurrentTitle(state.activeView, selectedThread);
  const currentProjectName = getProjectName(selectedProject);

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

  const handleAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    await invokeDesktopAction(action, payload);

    if (action === "thread.pin" || action === "thread.archive") {
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (projectId) {
        await loadProjectThreads(projectId);
      }

      if (action === "thread.archive" && state.archivedThreadsOpen) {
        setArchivedThreads(await loadArchivedThreads());
      }

      if (action === "thread.archive" && payload.threadId === state.selectedThreadId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "thread.restore" || action === "thread.delete") {
      setArchivedThreads(await loadArchivedThreads());
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (projectId) {
        await loadProjectThreads(projectId);
      }

      if (action === "thread.delete" && payload.threadId === state.selectedThreadId) {
        dispatch({ type: "show-view", view: "home" });
      }
    }

    if (action === "composer.model" || action === "composer.thinking") {
      await refreshShellState();
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

  const handleThreadOpen = (projectId: string, threadId: string) => {
    dispatch({ type: "open-thread", projectId, threadId });
    void handleAction("thread.open", { projectId, threadId });
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
                model={shellState?.composer.currentModel ?? null}
                availableModels={shellState?.composer.availableModels ?? []}
                thinkingLevel={shellState?.composer.currentThinkingLevel ?? "off"}
                availableThinkingLevels={shellState?.composer.availableThinkingLevels ?? ["off"]}
                onAction={(action, payload) => void handleAction(action, payload)}
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
