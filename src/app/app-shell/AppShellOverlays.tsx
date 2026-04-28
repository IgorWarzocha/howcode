import { TerminalPanel } from "../components/workspace/TerminalPanel";
import type { ProjectDiffBaseline } from "../desktop/types";
import { useCallback, useRef } from "react";
import type { AppShellController } from "./useAppShellController";

const TERMINAL_DRAWER_OFFSET = "min(28rem, calc(100% - 2.5rem))";

type AppShellOverlaysProps = {
  controller: AppShellController;
  composerProjectId: string;
  diffBaseline: ProjectDiffBaseline;
  takeoverPresent: boolean;
  takeoverVisible: boolean;
  takeoverTerminalKey: string;
  terminalDrawerVisible: boolean;
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
  takeoverTerminalKey,
  terminalDrawerVisible,
  terminalSessionPath,
  workspaceContentClass,
  onOpenGitOps,
  onSetDiffBaseline,
}: AppShellOverlaysProps) {
  const controllerRef = useRef(controller);
  const { projectGitState } = controller;
  controllerRef.current = controller;

  const handleReturnToDesktopFromTakeover = useCallback(() => {
    controllerRef.current.handleReturnToDesktopFromTakeover();
  }, []);

  const handleToggleTerminal = useCallback(() => {
    controllerRef.current.handleToggleTerminal();
  }, []);

  return takeoverPresent ? (
    <div
      data-open={takeoverVisible ? "true" : "false"}
      className="motion-takeover-panel absolute inset-0 z-10 h-full min-h-0 overflow-hidden bg-[color:var(--workspace)] px-5 pb-4"
    >
      <div
        className="motion-terminal-drawer-offset relative h-full min-h-0 overflow-hidden"
        style={terminalDrawerVisible ? { paddingRight: TERMINAL_DRAWER_OFFSET } : undefined}
      >
        <div className={`${workspaceContentClass} h-full min-h-0`}>
          <TerminalPanel
            key={takeoverTerminalKey}
            projectId={composerProjectId}
            sessionPath={terminalSessionPath}
            onClose={handleReturnToDesktopFromTakeover}
            onOpenDrawerTerminal={handleToggleTerminal}
            onOpenGitOps={onOpenGitOps}
            mode="takeover"
            projectGitState={projectGitState}
            diffBaseline={diffBaseline}
            onSetDiffBaseline={onSetDiffBaseline}
          />
        </div>
      </div>
    </div>
  ) : null;
}
