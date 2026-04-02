import { type CSSProperties, useEffect, useRef, useState } from "react";
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
    handleCloseTakeoverTerminal,
    handleOpenArchivedThreads,
    handleOpenDiffSelection,
    handleProjectSelect,
    handleSelectDiffTurn,
    handleShowTakeoverTerminal,
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

  const terminalSessionPath = state.activeView === "thread" ? state.selectedSessionPath : null;
  const takeoverVisible = state.takeoverVisible;
  const dockedTerminalVisible = state.terminalVisible;
  const diffVisible = state.diffVisible && !takeoverVisible;
  const [diffPanelWidth, setDiffPanelWidth] = useState(540);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) {
        return;
      }

      const nextWidth = resizeStart.width - (event.clientX - resizeStart.pointerX);
      setDiffPanelWidth(Math.max(380, Math.min(860, nextWidth)));
    };

    const handlePointerUp = () => {
      resizeStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const diffLayoutStyle = diffVisible
    ? ({ "--diff-panel-width": `${diffPanelWidth}px` } as CSSProperties)
    : undefined;

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
            style={diffLayoutStyle}
            className={
              diffVisible
                ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--diff-panel-width)] overflow-hidden pl-5 pr-0 max-xl:grid-cols-1"
                : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5"
            }
          >
            {takeoverVisible ? (
              <div className="mx-auto min-h-0 w-full max-w-[744px] overflow-hidden pt-1.5 pb-4">
                <TerminalPanel
                  projectId={composerProjectId}
                  sessionPath={terminalSessionPath}
                  onClose={handleCloseTakeoverTerminal}
                  mode="takeover"
                  hostLabel={shellState?.availableHosts[0] ?? "Local"}
                  profileLabel={shellState?.composerProfiles[0] ?? "Pi session"}
                  onAction={(action, payload) => void handleAction(action, payload)}
                />
              </div>
            ) : (
              <main
                className={
                  state.activeView === "thread"
                    ? "mb-5 min-h-0 overflow-hidden pt-1.5"
                    : mainPanelClass
                }
              >
                <MainView
                  activeView={state.activeView}
                  currentProjectName={currentProjectName}
                  threadData={activeThreadData}
                  onAction={(action, payload) => void handleAction(action, payload)}
                  onOpenTurnDiff={handleOpenDiffSelection}
                />
              </main>
            )}
            {diffVisible ? (
              <div className="relative min-h-0 max-xl:hidden">
                <div
                  className="absolute top-0 bottom-0 left-0 z-20 w-2 -translate-x-1/2 cursor-col-resize"
                  onPointerDown={(event) => {
                    resizeStartRef.current = {
                      pointerX: event.clientX,
                      width: diffPanelWidth,
                    };
                  }}
                />
                <DiffPanel
                  projectId={composerProjectId}
                  threadData={activeThreadData}
                  isGitRepo={projectGitState?.isGitRepo ?? false}
                  selectedTurnCount={state.selectedDiffTurnCount}
                  selectedFilePath={state.selectedDiffFilePath}
                  onSelectTurn={handleSelectDiffTurn}
                  onClose={handleToggleDiff}
                  onAction={(action, payload) => void handleAction(action, payload)}
                />
              </div>
            ) : null}
          </div>

          {takeoverVisible ? null : (
            <footer
              style={diffLayoutStyle}
              className={
                diffVisible
                  ? "relative z-10 -mt-5 shrink-0 grid grid-cols-[minmax(0,1fr)_var(--diff-panel-width)] pl-5 pr-0 pt-0 pb-4 max-xl:grid-cols-1"
                  : "relative z-10 -mt-5 shrink-0 grid gap-2.5 px-5 pt-0 pb-4"
              }
            >
              <div className="grid gap-2.5">
                <div className="mx-auto w-full max-w-[744px]">
                  <Composer
                    activeView={state.activeView}
                    hostLabel={shellState?.availableHosts[0] ?? "Local"}
                    profileLabel={shellState?.composerProfiles[0] ?? "Pi session"}
                    model={activeComposerState?.currentModel ?? null}
                    availableModels={activeComposerState?.availableModels ?? []}
                    thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                    availableThinkingLevels={
                      activeComposerState?.availableThinkingLevels ?? ["off"]
                    }
                    projectId={composerProjectId}
                    sessionPath={terminalSessionPath}
                    onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                    onPickAttachments={pickComposerAttachments}
                    onAction={handleAction}
                  />
                </div>
                {dockedTerminalVisible ? (
                  <div className="mx-auto w-full max-w-[744px]">
                    <TerminalPanel
                      projectId={composerProjectId}
                      sessionPath={terminalSessionPath}
                      onClose={handleToggleTerminal}
                      mode="docked"
                      onAction={(action, payload) => void handleAction(action, payload)}
                    />
                  </div>
                ) : null}
              </div>
              {diffVisible ? <div className="max-xl:hidden" /> : null}
            </footer>
          )}
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
