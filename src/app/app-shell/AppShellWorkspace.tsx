import type { CSSProperties } from "react";
import { Composer } from "../components/workspace/Composer";
import { DiffPanel } from "../components/workspace/DiffPanel";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { mainPanelClass } from "../ui/classes";
import { MainView } from "../views/MainView";
import type { AppShellController } from "./useAppShellController";

type AppShellWorkspaceProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  currentProjectName: string;
  diffLayoutStyle?: CSSProperties;
  dockedTerminalVisible: boolean;
  handleDiffResizeStart: (pointerX: number) => void;
  splitDiffVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
};

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffLayoutStyle,
  dockedTerminalVisible,
  handleDiffResizeStart,
  splitDiffVisible,
  terminalSessionPath,
  workspaceContentClass,
}: AppShellWorkspaceProps) {
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleOpenDiffSelection,
    handleSelectDiffTurn,
    handleShowTakeoverTerminal,
    handleToggleDiff,
    handleToggleTerminal,
    pickComposerAttachments,
    projectGitState,
    shellState,
    state,
  } = controller;
  const showWorkspaceFooter = state.activeView !== "settings";

  return (
    <>
      <div
        style={diffLayoutStyle}
        className={
          splitDiffVisible
            ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--diff-panel-width)] overflow-hidden pl-5 pr-0"
            : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5"
        }
      >
        <main
          className={
            state.activeView === "thread" ? "mb-5 min-h-0 overflow-hidden pt-1.5" : mainPanelClass
          }
        >
          <MainView
            activeView={state.activeView}
            appSettings={shellState?.appSettings ?? { gitCommitMessageModel: null }}
            availableModels={activeComposerState?.availableModels ?? []}
            currentModel={activeComposerState?.currentModel ?? null}
            currentProjectName={currentProjectName}
            threadData={activeThreadData}
            onAction={(action, payload) => void handleAction(action, payload)}
            onLoadEarlierMessages={handleLoadEarlierMessages}
            onOpenTurnDiff={handleOpenDiffSelection}
          />
        </main>
        {splitDiffVisible ? (
          <div className="relative min-h-0">
            <div
              className="absolute top-0 bottom-0 left-0 z-20 w-2 -translate-x-1/2 cursor-col-resize"
              onPointerDown={(event) => handleDiffResizeStart(event.clientX)}
            />
            <DiffPanel
              projectId={composerProjectId}
              threadData={activeThreadData}
              isGitRepo={projectGitState?.isGitRepo ?? false}
              selectedTurnCount={state.selectedDiffTurnCount}
              selectedFilePath={state.selectedDiffFilePath}
              onSelectTurn={handleSelectDiffTurn}
              layoutMode="split"
              onClose={handleToggleDiff}
              onAction={(action, payload) => void handleAction(action, payload)}
            />
          </div>
        ) : null}
      </div>

      {showWorkspaceFooter ? (
        <footer
          style={diffLayoutStyle}
          className={
            splitDiffVisible
              ? "relative z-10 -mt-5 shrink-0 grid grid-cols-[minmax(0,1fr)_var(--diff-panel-width)] pl-5 pr-0 pt-0 pb-4"
              : "relative z-10 -mt-5 shrink-0 grid gap-2.5 px-5 pt-0 pb-4"
          }
        >
          <div className="grid gap-2.5">
            <div className={workspaceContentClass}>
              <Composer
                activeView={state.activeView}
                hostLabel={shellState?.availableHosts[0] ?? "Local"}
                profileLabel={shellState?.composerProfiles[0] ?? "Pi session"}
                model={activeComposerState?.currentModel ?? null}
                availableModels={activeComposerState?.availableModels ?? []}
                thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                projectId={composerProjectId}
                projectGitState={projectGitState}
                sessionPath={terminalSessionPath}
                onOpenDiffPanel={() => {
                  if (!state.diffVisible) {
                    handleToggleDiff();
                  }
                }}
                onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                onPickAttachments={pickComposerAttachments}
                onAction={handleAction}
              />
            </div>
            {dockedTerminalVisible ? (
              <div className={workspaceContentClass}>
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
          {splitDiffVisible ? <div /> : null}
        </footer>
      ) : null}
    </>
  );
}
