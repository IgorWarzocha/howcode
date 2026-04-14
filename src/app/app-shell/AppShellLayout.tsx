import { useEffect, useState } from "react";
import { ArchivedThreadsPanel } from "../components/settings/ArchivedThreadsPanel";
import { ProjectActionDialog } from "../components/sidebar/ProjectActionDialog";
import { Sidebar } from "../components/sidebar/Sidebar";
import { defaultDiffBaseline } from "../components/workspace/composer/diff-baseline";
import type { ProjectDiffBaseline } from "../desktop/types";
import { AppShellOverlays } from "./AppShellOverlays";
import { AppShellWorkspace } from "./AppShellWorkspace";
import type { AppShellController } from "./useAppShellController";
import { useAppShellLayoutState } from "./useAppShellLayoutState";

type AppShellLayoutProps = {
  controller: AppShellController;
};

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const [diffBaselineState, setDiffBaselineState] = useState<{
    projectId: string;
    baseline: ProjectDiffBaseline;
  }>({
    projectId: "",
    baseline: defaultDiffBaseline,
  });
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

  const terminalSessionPath =
    state.activeView === "thread" || state.activeView === "gitops"
      ? state.selectedSessionPath
      : null;
  const takeoverVisible = state.takeoverVisible;
  const dockedTerminalVisible = state.terminalVisible;
  const diffBaseline =
    diffBaselineState.projectId === composerProjectId
      ? diffBaselineState.baseline
      : defaultDiffBaseline;
  const { mainSectionRef, takeoverPresent, desktopWorkspacePresent, workspaceContentClass } =
    useAppShellLayoutState({
      takeoverVisible,
    });

  useEffect(() => {
    setDiffBaselineState((current) => {
      if (current.projectId === composerProjectId && current.baseline.kind === "head") {
        return current;
      }

      return {
        projectId: composerProjectId,
        baseline: defaultDiffBaseline,
      };
    });
  }, [composerProjectId]);

  return (
    <>
      <div className="relative flex h-screen overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)]">
        <div className="relative w-[300px] max-w-[calc(100vw-1rem)] min-w-0 shrink-0">
          <Sidebar
            projects={projects}
            inboxThreads={controller.inboxThreads}
            appSettings={
              controller.shellState?.appSettings ?? {
                gitCommitMessageModel: null,
                skillCreatorModel: null,
                favoriteFolders: [],
                projectImportState: null,
                preferredProjectLocation: null,
                initializeGitOnProjectCreate: false,
                useAgentsSkillsPaths: false,
                piTuiTakeover: false,
              }
            }
            activeView={state.activeView}
            selectedInboxSessionPath={state.selectedInboxSessionPath}
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
            onDismissInboxThread={controller.handleDismissInboxThread}
            onProjectSelect={handleProjectSelect}
            onProjectReorder={handleProjectReorder}
            onSelectInboxThread={controller.handleSelectInboxThread}
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
                  diffBaseline={diffBaseline}
                  dockedTerminalVisible={dockedTerminalVisible}
                  terminalSessionPath={terminalSessionPath}
                  workspaceContentClass={workspaceContentClass}
                  onSetDiffBaseline={(baseline) => {
                    setDiffBaselineState({
                      projectId: composerProjectId,
                      baseline,
                    });
                  }}
                />
              </div>
            ) : null}

            <AppShellOverlays
              controller={controller}
              composerProjectId={composerProjectId}
              diffBaseline={diffBaseline}
              takeoverPresent={takeoverPresent}
              takeoverVisible={takeoverVisible}
              terminalSessionPath={terminalSessionPath}
              onOpenGitOps={async () => {
                controller.handleOpenGitOpsView();
                await controller.handleCloseTakeoverTerminal();
              }}
              onSetDiffBaseline={(baseline) => {
                setDiffBaselineState({
                  projectId: composerProjectId,
                  baseline,
                });
              }}
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
