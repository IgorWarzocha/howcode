import { ArchivedThreadsPanel } from "../components/settings/ArchivedThreadsPanel";
import { ProjectActionDialog } from "../components/sidebar/ProjectActionDialog";
import { Sidebar } from "../components/sidebar/Sidebar";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import { AppShellOverlays } from "./AppShellOverlays";
import { AppShellWorkspace } from "./AppShellWorkspace";
import type { AppShellController } from "./useAppShellController";
import { useAppShellLayoutState } from "./useAppShellLayoutState";

type AppShellLayoutProps = {
  controller: AppShellController;
};

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const {
    activeComposerState,
    activeThreadData,
    archivedThreads,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
    handleAction,
    handleCloseArchivedThreads,
    handleCloseProjectActionDialog,
    handleConfirmProjectAction,
    handleCollapseAll,
    handleOpenArchivedThreads,
    handleProjectReorder,
    handleProjectSelect,
    handleShowView,
    handleThreadOpen,
    handleToggleProjectCollapse,
    handleToggleSettings,
    handleToggleSidebar,
    pendingProjectAction,
    projects,
    projectGitState,
    state,
  } = controller;

  const terminalSessionPath = state.activeView === "thread" ? state.selectedSessionPath : null;
  const takeoverVisible = state.takeoverVisible;
  const dockedTerminalVisible = state.terminalVisible;
  const { mainSectionRef, takeoverPresent, desktopWorkspacePresent, workspaceContentClass } =
    useAppShellLayoutState({
      takeoverVisible,
    });

  return (
    <>
      <div
        className={
          state.sidebarVisible
            ? "grid h-screen grid-cols-[minmax(0,1fr)] overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)] md:grid-cols-[300px_minmax(0,1fr)]"
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
          onToggleSidebar={handleToggleSidebar}
          onToggleSettings={handleToggleSettings}
          onOpenSettingsPanel={() => {
            handleShowView("settings");
            handleToggleSettings();
          }}
          onOpenArchivedThreads={handleOpenArchivedThreads}
          onCollapseAll={handleCollapseAll}
          onProjectSelect={handleProjectSelect}
          onProjectReorder={handleProjectReorder}
          onThreadOpen={handleThreadOpen}
          onToggleProjectCollapse={handleToggleProjectCollapse}
        />

        <section
          ref={mainSectionRef}
          className="flex min-w-0 min-h-0 flex-col overflow-hidden bg-[color:var(--workspace)]"
        >
          <WorkspaceHeader
            activeView={state.activeView}
            currentTitle={currentTitle}
            currentProjectName={currentProjectName}
            sidebarVisible={state.sidebarVisible}
            projectGitState={projectGitState}
            onAction={(action, payload) => void handleAction(action, payload)}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {desktopWorkspacePresent ? (
              <div
                data-open={!takeoverVisible ? "true" : "false"}
                className="motion-desktop-workspace flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <AppShellWorkspace
                  controller={controller}
                  activeComposerState={activeComposerState}
                  activeThreadData={activeThreadData}
                  composerProjectId={composerProjectId}
                  currentProjectName={currentProjectName}
                  dockedTerminalVisible={dockedTerminalVisible}
                  terminalSessionPath={terminalSessionPath}
                  workspaceContentClass={workspaceContentClass}
                />
              </div>
            ) : null}

            <AppShellOverlays
              controller={controller}
              composerProjectId={composerProjectId}
              takeoverPresent={takeoverPresent}
              takeoverVisible={takeoverVisible}
              terminalSessionPath={terminalSessionPath}
            />
          </div>
        </section>
      </div>

      <ArchivedThreadsPanel
        open={state.archivedThreadsOpen}
        threads={archivedThreads}
        onClose={handleCloseArchivedThreads}
        onAction={(action, payload) => void handleAction(action, payload)}
      />
      <ProjectActionDialog
        pendingAction={pendingProjectAction}
        onClose={handleCloseProjectActionDialog}
        onConfirm={handleConfirmProjectAction}
      />
    </>
  );
}
