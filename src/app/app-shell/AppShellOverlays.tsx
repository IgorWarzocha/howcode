import { TerminalPanel } from "../components/workspace/TerminalPanel";
import type { ProjectDiffBaseline } from "../desktop/types";
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../ui/layout";
import type { AppShellController } from "./useAppShellController";

type AppShellOverlaysProps = {
  controller: AppShellController;
  composerProjectId: string;
  diffBaseline: ProjectDiffBaseline;
  takeoverPresent: boolean;
  takeoverVisible: boolean;
  terminalSessionPath: string | null;
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
          className="motion-takeover-panel absolute inset-0 z-10 bg-[color:var(--workspace)]"
        >
          <div
            className={`mx-auto min-h-0 h-full w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} overflow-hidden px-5 pt-1.5 pb-4`}
          >
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
