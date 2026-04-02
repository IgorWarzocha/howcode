import { useEffect, useMemo, useReducer } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Composer } from "./components/workspace/Composer";
import { DiffPanel } from "./components/workspace/DiffPanel";
import { TerminalPanel } from "./components/workspace/TerminalPanel";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader";
import type { DesktopAction } from "./desktop/actions";
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
  const shellState = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const projects = shellState?.projects ?? [];

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
    if (!projects.length || state.selectedProjectId) {
      return;
    }

    dispatch({ type: "select-project", projectId: projects[0].id });
  }, [projects, state.selectedProjectId]);

  const handleAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    await invokeDesktopAction(action, payload);
  };

  const handleShowView = (view: View) => {
    dispatch({ type: "show-view", view });
  };

  const handleThreadOpen = (projectId: string, threadId: string) => {
    dispatch({ type: "open-thread", projectId, threadId });
    void handleAction("thread.open", { projectId, threadId });
  };

  return (
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
        collapsedProjectIds={state.collapsedProjectIds}
        onAction={(action, payload) => void handleAction(action, payload)}
        onShowView={handleShowView}
        onToggleSidebar={() => dispatch({ type: "toggle-sidebar" })}
        onToggleSettings={() => dispatch({ type: "toggle-settings" })}
        onCollapseAll={() => dispatch({ type: "collapse-all-projects" })}
        onProjectSelect={(projectId) => dispatch({ type: "select-project", projectId })}
        onThreadOpen={handleThreadOpen}
        onToggleProjectCollapse={(projectId) =>
          dispatch({ type: "toggle-project-collapse", projectId })
        }
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
              profileLabel={shellState?.composerProfiles[0] ?? "Custom (config.toml)"}
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
  );
}
