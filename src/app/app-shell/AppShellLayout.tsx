import { PanelLeft } from "lucide-react";
import { ArchivedThreadsPanel } from "../components/settings/ArchivedThreadsPanel";
import { ProjectActionDialog } from "../components/sidebar/ProjectActionDialog";
import { Sidebar } from "../components/sidebar/Sidebar";
import { iconButtonClass } from "../ui/classes";
import { cn } from "../utils/cn";
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
        {state.sidebarVisible ? (
          <div className="relative min-h-0 min-w-0">
            <Sidebar
              projects={projects}
              activeView={state.activeView}
              selectedProjectId={state.selectedProjectId}
              selectedThreadId={state.selectedThreadId}
              settingsOpen={state.settingsOpen}
              collapsedProjectIds={collapsedProjectIds}
              onAction={(action, payload) => void handleAction(action, payload)}
              onShowView={handleShowView}
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

            <button
              type="button"
              className={cn(
                "absolute top-3 left-full z-20 ml-2.5 border-[color:var(--border)] bg-[rgba(35,38,51,0.95)] shadow-[0_10px_30px_rgba(0,0,0,0.22)]",
                iconButtonClass,
              )}
              onClick={handleToggleSidebar}
              aria-label="Hide sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        ) : null}

        <section
          ref={mainSectionRef}
          className="flex min-w-0 min-h-0 flex-col overflow-hidden bg-[color:var(--workspace)]"
        >
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

      {!state.sidebarVisible ? (
        <button
          type="button"
          className={cn(
            "fixed top-3 left-2.5 z-20 border-[color:var(--border)] bg-[rgba(35,38,51,0.95)] shadow-[0_10px_30px_rgba(0,0,0,0.22)]",
            iconButtonClass,
          )}
          onClick={handleToggleSidebar}
          aria-label="Show sidebar"
        >
          <PanelLeft size={16} />
        </button>
      ) : null}

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
