import { useEffect, useState } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { defaultDiffBaseline } from "../components/workspace/composer/diff-baseline";
import type { ProjectDiffBaseline } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { AppShellOverlays } from "./AppShellOverlays";
import { AppShellWorkspace } from "./AppShellWorkspace";
import type { AppShellController } from "./useAppShellController";
import { useAppShellLayoutState } from "./useAppShellLayoutState";

const TERMINAL_DRAWER_WIDTH = "min(28rem, calc(100% - 2.5rem))";

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
    handleProjectReorder,
    handleProjectSelect,
    handleShowView,
    handleThreadOpen,
    handleToggleProjectCollapse,
    handleToggleSettings,
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
  const terminalDrawerVisible = state.activeView === "thread" && state.terminalVisible;
  const terminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible);
  const diffBaseline =
    diffBaselineState.projectId === composerProjectId
      ? diffBaselineState.baseline
      : defaultDiffBaseline;
  const { mainSectionRef, takeoverPresent, workspaceContentClass } = useAppShellLayoutState({
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
            appLaunchedAtMs={controller.appLaunchedAtMs}
            appSettings={
              controller.shellState?.appSettings ?? {
                gitCommitMessageModel: null,
                skillCreatorModel: null,
                favoriteFolders: [],
                projectImportState: null,
                preferredProjectLocation: null,
                initializeGitOnProjectCreate: false,
                projectDeletionMode: "pi-only",
                useAgentsSkillsPaths: false,
                piTuiTakeover: false,
              }
            }
            activeView={state.activeView}
            protectedProjectId={
              controller.shellState?.resolvedCwd ?? controller.shellState?.cwd ?? null
            }
            selectedInboxSessionPath={state.selectedInboxSessionPath}
            selectedProjectId={state.selectedProjectId}
            selectedThreadId={state.selectedThreadId}
            settingsOpen={state.settingsOpen}
            projectScopeLockActive={projectScopeLockActive}
            terminalRunningProjectIds={controller.terminalRunningProjectIds}
            terminalRunningSessionPaths={controller.terminalRunningSessionPaths}
            collapsedProjectIds={effectiveCollapsedProjectIds}
            onAction={handleAction}
            onShowView={handleShowView}
            onToggleSettings={handleToggleSettings}
            onOpenExtensionsView={() => {
              handleShowView("extensions");
            }}
            onOpenSkillsView={() => {
              handleShowView("skills");
            }}
            onOpenSettingsPanel={() => {
              handleShowView("settings");
            }}
            onOpenArchivedThreads={() => {
              handleShowView("archived");
            }}
            onDismissInboxThread={controller.handleDismissInboxThread}
            onProjectSelect={handleProjectSelect}
            onProjectReorder={handleProjectReorder}
            onLoadProjectThreads={controller.handleLoadProjectThreads}
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
                terminalDrawerVisible={terminalDrawerVisible}
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

            <AppShellOverlays
              controller={controller}
              composerProjectId={composerProjectId}
              diffBaseline={diffBaseline}
              takeoverPresent={takeoverPresent}
              takeoverVisible={takeoverVisible}
              terminalDrawerVisible={terminalDrawerVisible}
              terminalSessionPath={terminalSessionPath}
              workspaceContentClass={workspaceContentClass}
              onOpenGitOps={async () => {
                controller.handleOpenGitOpsView();
                await controller.handleCloseTakeoverTerminal({
                  preserveSessionOverride: true,
                  refreshThread: false,
                });
              }}
              onSetDiffBaseline={(baseline) => {
                setDiffBaselineState({
                  projectId: composerProjectId,
                  baseline,
                });
              }}
            />

            {terminalDrawerPresent ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-20"
                style={{ width: TERMINAL_DRAWER_WIDTH }}
              >
                <div
                  data-open={terminalDrawerVisible ? "true" : "false"}
                  className={`motion-terminal-drawer h-full ${terminalDrawerVisible ? "pointer-events-auto" : "pointer-events-none"}`}
                >
                  <TerminalPanel
                    projectId={composerProjectId}
                    sessionPath={terminalSessionPath}
                    onClose={controller.handleToggleTerminal}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {controller.toast ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 text-[13px] text-[color:var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm">
          {controller.toast}
        </div>
      ) : null}
    </>
  );
}
