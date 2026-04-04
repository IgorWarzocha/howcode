import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../ui/layout";
import type { AppShellController } from "./useAppShellController";

type AppShellOverlaysProps = {
  controller: AppShellController;
  composerProjectId: string;
  takeoverPresent: boolean;
  takeoverVisible: boolean;
  terminalSessionPath: string | null;
};

export function AppShellOverlays({
  controller,
  composerProjectId,
  takeoverPresent,
  takeoverVisible,
  terminalSessionPath,
}: AppShellOverlaysProps) {
  const { handleAction, handleCloseTakeoverTerminal, shellState } = controller;

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
              onAction={(action, payload) => void handleAction(action, payload)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
