import { ArchivedThreadsPanel } from "../components/settings/ArchivedThreadsPanel";
import { ProjectActionDialog } from "../components/sidebar/ProjectActionDialog";
import { Sidebar } from "../components/sidebar/Sidebar";
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
    pendingProjectAction,
    projects,
    extensionsProjectScopeActive,
    skillsProjectScopeActive,
    state,
  } = controller;
  const projectScopeLockActive = extensionsProjectScopeActive || skillsProjectScopeActive;
  const effectiveCollapsedProjectIds = projectScopeLockActive
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
      <div className="relative flex h-screen overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)]">
        <div className="relative w-[300px] max-w-[calc(100vw-1rem)] min-w-0 shrink-0">
          <Sidebar
            projects={projects}
            appSettings={
              controller.shellState?.appSettings ?? {
                gitCommitMessageModel: null,
                skillCreatorModel: null,
                favoriteFolders: [],
                projectImportState: null,
                preferredProjectLocation: null,
                initializeGitOnProjectCreate: false,
                useAgentsSkillsPaths: false,
              }
            }
            activeView={state.activeView}
            selectedProjectId={state.selectedProjectId}
            selectedThreadId={state.selectedThreadId}
            settingsOpen={state.settingsOpen}
            projectScopeLockActive={projectScopeLockActive}
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
            onOpenSkillsView={() => {
              handleShowView("skills");
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
            onOpenArchivedThreads={() => {
              handleOpenArchivedThreads();
              if (state.settingsOpen) {
                handleToggleSettings();
              }
            }}
            onProjectSelect={handleProjectSelect}
            onProjectReorder={handleProjectReorder}
            onThreadOpen={handleThreadOpen}
            onToggleProjectCollapse={handleToggleProjectCollapse}
          />
        </div>

        <section
          ref={mainSectionRef}
          className="flex min-w-0 min-h-0 h-full flex-1 flex-col overflow-hidden bg-[color:var(--workspace)]"
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

      <ArchivedThreadsPanel
        open={state.archivedThreadsOpen}
        threads={archivedThreads}
        onClose={handleCloseArchivedThreads}
        onAction={handleAction}
      />
      <ProjectActionDialog
        pendingAction={pendingProjectAction}
        onClose={handleCloseProjectActionDialog}
        onConfirm={handleConfirmProjectAction}
      />
    </>
  );
}
