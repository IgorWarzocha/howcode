import { useState } from "react";
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
  dockedTerminalVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
};

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  dockedTerminalVisible,
  terminalSessionPath,
  workspaceContentClass,
}: AppShellWorkspaceProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0);
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
  const showDiffInMainView = state.diffVisible && showWorkspaceFooter;

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5">
        <main
          className={
            state.activeView === "thread" || showDiffInMainView
              ? "mb-5 min-h-0 overflow-hidden pt-1.5"
              : mainPanelClass
          }
        >
          {showDiffInMainView ? (
            <DiffPanel
              projectId={composerProjectId}
              threadData={activeThreadData}
              isGitRepo={projectGitState?.isGitRepo ?? false}
              selectedTurnCount={state.selectedDiffTurnCount}
              selectedFilePath={state.selectedDiffFilePath}
              onSelectTurn={handleSelectDiffTurn}
              layoutMode="main"
              onSendCommentsToAgent={async (prompt) => {
                await handleAction("composer.send", { text: prompt });
                setComposerPromptResetKey((current) => current + 1);
              }}
              onClose={handleToggleDiff}
              onAction={(action, payload) => void handleAction(action, payload)}
            />
          ) : (
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
          )}
        </main>
      </div>

      {showWorkspaceFooter ? (
        <footer className="relative z-10 -mt-5 shrink-0 grid gap-2.5 px-5 pt-0 pb-4">
          <div className="grid gap-2.5">
            <div className={workspaceContentClass}>
              <Composer
                activeView={state.activeView}
                hostLabel={shellState?.availableHosts[0] ?? "Local"}
                model={activeComposerState?.currentModel ?? null}
                availableModels={activeComposerState?.availableModels ?? []}
                thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                projectId={composerProjectId}
                projectGitState={projectGitState}
                sessionPath={terminalSessionPath}
                onSetDiffPanelVisible={(visible) => {
                  if (visible === state.diffVisible) {
                    return;
                  }

                  handleToggleDiff();
                }}
                promptResetKey={composerPromptResetKey}
                onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                onToggleTerminal={handleToggleTerminal}
                terminalVisible={state.terminalVisible}
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
        </footer>
      ) : null}
    </>
  );
}
