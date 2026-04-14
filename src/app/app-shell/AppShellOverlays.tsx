import { TerminalPanel } from "../components/workspace/TerminalPanel";
import type { ProjectDiffBaseline } from "../desktop/types";
import type { AppShellController } from "./useAppShellController";

type AppShellOverlaysProps = {
  controller: AppShellController;
  composerProjectId: string;
  diffBaseline: ProjectDiffBaseline;
  takeoverPresent: boolean;
  takeoverVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
  onOpenGitOps: () => void;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
};

export function AppShellOverlays({
  controller,
  composerProjectId,
  diffBaseline,
  takeoverPresent,
  takeoverVisible,
  terminalSessionPath,
  workspaceContentClass,
  onOpenGitOps,
  onSetDiffBaseline,
}: AppShellOverlaysProps) {
  const { handleCloseTakeoverTerminal, handleOpenDockedTerminalFromTakeover, projectGitState } =
    controller;

  return (
    <>
      {takeoverPresent ? (
        <div
          data-open={takeoverVisible ? "true" : "false"}
          className="motion-takeover-panel absolute inset-0 z-10 bg-[color:var(--terminal-bg)] px-5 pb-4"
        >
          <div className={`${workspaceContentClass} h-full min-h-0`}>
            <TerminalPanel
              projectId={composerProjectId}
              sessionPath={terminalSessionPath}
              onClose={handleCloseTakeoverTerminal}
              onOpenDockedTerminal={handleOpenDockedTerminalFromTakeover}
              onOpenGitOps={onOpenGitOps}
              mode="takeover"
              projectGitState={projectGitState}
              diffBaseline={diffBaseline}
              onSetDiffBaseline={onSetDiffBaseline}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
