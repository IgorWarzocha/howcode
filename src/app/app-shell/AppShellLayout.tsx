import { ArchivedThreadsPanel } from "../components/settings/ArchivedThreadsPanel";
import { ProjectActionDialog } from "../components/sidebar/ProjectActionDialog";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Composer } from "../components/workspace/Composer";
import { DiffPanel } from "../components/workspace/DiffPanel";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import { mainPanelClass } from "../ui/classes";
import { MainView } from "../views/MainView";
import type { AppShellController } from "./useAppShellController";

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
    handleProjectSelect,
    handleShowView,
    handleThreadOpen,
    handleToggleDiff,
    handleToggleProjectCollapse,
    handleToggleSettings,
    handleToggleSidebar,
    handleToggleTerminal,
    pendingProjectAction,
    pickComposerAttachments,
    projects,
    projectGitState,
    shellState,
    state,
  } = controller;

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
          onToggleSidebar={handleToggleSidebar}
          onToggleSettings={handleToggleSettings}
          onOpenArchivedThreads={handleOpenArchivedThreads}
          onCollapseAll={handleCollapseAll}
          onProjectSelect={handleProjectSelect}
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
            projectGitState={projectGitState}
            onAction={(action, payload) => void handleAction(action, payload)}
            onToggleTerminal={handleToggleTerminal}
            onToggleDiff={handleToggleDiff}
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
                onPickAttachments={pickComposerAttachments}
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

      <ProjectActionDialog
        pendingAction={pendingProjectAction}
        onClose={handleCloseProjectActionDialog}
        onConfirm={handleConfirmProjectAction}
      />
    </>
  );
}
