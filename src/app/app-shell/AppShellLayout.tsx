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
  const effectiveCollapsedProjectIds = controller.extensionsProjectScopeActive
    ? Object.fromEntries(projects.map((project) => [project.id, true]))
    : collapsedProjectIds;

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
        className="motion-shell-root relative h-screen overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)]"
        data-sidebar-open={state.sidebarVisible ? "true" : "false"}
      >
        <div
          className="motion-sidebar-panel absolute inset-y-0 left-0 z-10 w-[300px] max-w-[calc(100vw-1rem)] min-w-0"
          data-open={state.sidebarVisible ? "true" : "false"}
          aria-hidden={state.sidebarVisible ? undefined : true}
        >
          <Sidebar
            projects={projects}
            appSettings={
              controller.shellState?.appSettings ?? {
                gitCommitMessageModel: null,
                favoriteFolders: [],
                projectImportState: null,
                preferredProjectLocation: null,
                initializeGitOnProjectCreate: false,
              }
            }
            activeView={state.activeView}
            selectedProjectId={state.selectedProjectId}
            selectedThreadId={state.selectedThreadId}
            settingsOpen={state.settingsOpen}
            projectScopeLockActive={controller.extensionsProjectScopeActive}
            collapsedProjectIds={effectiveCollapsedProjectIds}
            onAction={handleAction}
            onShowView={handleShowView}
            onToggleSettings={handleToggleSettings}
            onOpenExtensionsView={() => {
              handleShowView("extensions");
              if (state.settingsOpen) {
                handleToggleSettings();
              }
            }}
            onOpenSettingsPanel={() => {
              handleShowView("settings");
              if (state.settingsOpen) {
                handleToggleSettings();
              }
            }}
            onOpenArchivedThreads={handleOpenArchivedThreads}
            onProjectSelect={handleProjectSelect}
            onProjectReorder={handleProjectReorder}
            onThreadOpen={handleThreadOpen}
            onToggleProjectCollapse={handleToggleProjectCollapse}
          />
        </div>

        <section
          ref={mainSectionRef}
          className="motion-shell-main flex min-w-0 min-h-0 h-full flex-col overflow-hidden bg-[color:var(--workspace)]"
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

      <button
        type="button"
        className={cn(
          "motion-sidebar-toggle fixed top-3 left-2.5 z-20 border-[color:var(--border)] bg-[rgba(35,38,51,0.95)] shadow-[0_10px_30px_rgba(0,0,0,0.22)]",
          iconButtonClass,
        )}
        data-open={state.sidebarVisible ? "true" : "false"}
        onClick={handleToggleSidebar}
        aria-label={state.sidebarVisible ? "Hide sidebar" : "Show sidebar"}
      >
        <PanelLeft size={16} />
      </button>

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
