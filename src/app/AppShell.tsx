import { useMemo, useReducer } from "react";
import { SurfacePanel } from "./components/common/SurfacePanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Composer } from "./components/workspace/Composer";
import { DiffPanel } from "./components/workspace/DiffPanel";
import { TerminalPanel } from "./components/workspace/TerminalPanel";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader";
import { mockProjects } from "./data/mock-data";
import type { DesktopAction } from "./desktop/actions";
import { useDesktopBridge } from "./hooks/useDesktopBridge";
import { useDesktopShell } from "./hooks/useDesktopShell";
import { useToast } from "./hooks/useToast";
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
  const [state, dispatch] = useReducer(workspaceReducer, mockProjects, createInitialWorkspaceState);
  const shellState = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const { toast, showToast } = useToast();

  const selectedProject = useMemo(
    () => selectProject(mockProjects, state.selectedProjectId),
    [state.selectedProjectId],
  );
  const selectedThread = useMemo(
    () => selectThread(selectedProject, state.selectedThreadId),
    [selectedProject, state.selectedThreadId],
  );
  const currentTitle = getCurrentTitle(state.activeView, selectedThread);
  const currentProjectName = getProjectName(selectedProject);

  const handleAction = async (action: DesktopAction, payload: Record<string, unknown> = {}) => {
    showToast(`${action} — stubbed for now`);
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
    <div className="grid h-screen grid-cols-[300px_minmax(0,1fr)] text-[color:var(--text)] max-md:grid-cols-1 max-xl:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar
        projects={mockProjects}
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

      <section className="flex min-w-0 flex-col">
        <WorkspaceHeader
          activeView={state.activeView}
          currentTitle={currentTitle}
          currentProjectName={currentProjectName}
          terminalVisible={state.terminalVisible}
          diffVisible={state.diffVisible}
          onAction={(action, payload) => void handleAction(action, payload)}
          onToggleTerminal={() => dispatch({ type: "toggle-terminal" })}
          onToggleDiff={() => dispatch({ type: "toggle-diff" })}
        />

        <div
          className={
            state.diffVisible
              ? "grid flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3 px-[18px] min-h-0 max-xl:grid-cols-1"
              : "grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 px-[18px] min-h-0"
          }
        >
          <main className={mainPanelClass}>
            <MainView
              activeView={state.activeView}
              currentProjectName={currentProjectName}
              onAction={(action, payload) => void handleAction(action, payload)}
            />
          </main>
          {state.diffVisible ? (
            <div className="max-xl:hidden">
              <DiffPanel onAction={(action, payload) => void handleAction(action, payload)} />
            </div>
          ) : null}
        </div>

        <footer className="grid gap-2.5 px-[18px] pt-3 pb-[18px]">
          <Composer
            activeView={state.activeView}
            hostLabel={shellState?.availableHosts[0] ?? "Local"}
            profileLabel={shellState?.composerProfiles[0] ?? "Custom (config.toml)"}
            onAction={(action, payload) => void handleAction(action, payload)}
          />
          {state.terminalVisible ? (
            <TerminalPanel onAction={(action, payload) => void handleAction(action, payload)} />
          ) : null}
        </footer>
      </section>

      {toast ? (
        <SurfacePanel className="fixed right-[18px] bottom-[18px] border-[color:var(--border-strong)] bg-[rgba(27,31,42,0.95)] px-3.5 py-2.5">
          {toast}
        </SurfacePanel>
      ) : null}
    </div>
  );
}
