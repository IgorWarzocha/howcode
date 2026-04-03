import { DiffPanel } from "../components/workspace/DiffPanel";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../ui/layout";
import type { AppShellController } from "./useAppShellController";

type AppShellOverlaysProps = {
  controller: AppShellController;
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  overlayDiffPresent: boolean;
  overlayDiffVisible: boolean;
  takeoverPresent: boolean;
  takeoverVisible: boolean;
  terminalSessionPath: string | null;
};

export function AppShellOverlays({
  controller,
  activeThreadData,
  composerProjectId,
  overlayDiffPresent,
  overlayDiffVisible,
  takeoverPresent,
  takeoverVisible,
  terminalSessionPath,
}: AppShellOverlaysProps) {
  const {
    handleAction,
    handleCloseTakeoverTerminal,
    handleSelectDiffTurn,
    handleToggleDiff,
    projectGitState,
    shellState,
    state,
  } = controller;

  return (
    <>
      {takeoverPresent ? (
        <div
          data-open={takeoverVisible ? "true" : "false"}
          className="motion-takeover-panel absolute inset-0 z-10 bg-[color:var(--workspace)]"
        >
          <div
            className={`mx-auto min-h-0 h-full w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} overflow-hidden px-5 pt-1.5 pb-4`}
          >
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
        </div>
      ) : null}

      {overlayDiffPresent ? (
        <div
          data-open={overlayDiffVisible ? "true" : "false"}
          className="motion-overlay-panel absolute inset-0 z-20 bg-[color:var(--workspace)]"
        >
          <DiffPanel
            projectId={composerProjectId}
            threadData={activeThreadData}
            isGitRepo={projectGitState?.isGitRepo ?? false}
            selectedTurnCount={state.selectedDiffTurnCount}
            selectedFilePath={state.selectedDiffFilePath}
            onSelectTurn={handleSelectDiffTurn}
            layoutMode="overlay"
            onClose={handleToggleDiff}
            onAction={(action, payload) => void handleAction(action, payload)}
          />
        </div>
      ) : null}
    </>
  );
}
