import { TerminalPanel } from "../components/workspace/TerminalPanel";
import type { ProjectDiffBaseline } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import type { AppShellController } from "./useAppShellController";

const TERMINAL_DRAWER_WIDTH = "min(28rem, calc(100% - 2.5rem))";
const TERMINAL_DRAWER_OFFSET = TERMINAL_DRAWER_WIDTH;

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
  const { handleReturnToDesktopFromTakeover, handleToggleTerminal, projectGitState, state } =
    controller;
  const terminalDrawerVisible =
    takeoverVisible && state.activeView === "thread" && state.terminalVisible;
  const terminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible);

  return (
    <>
      {takeoverPresent ? (
        <div
          data-open={takeoverVisible ? "true" : "false"}
          className="motion-takeover-panel absolute inset-0 z-10 bg-[color:var(--workspace)] px-5 pb-4"
        >
          <div
            className="relative h-full min-h-0 overflow-hidden transition-[padding-right] duration-150 ease-out"
            style={terminalDrawerVisible ? { paddingRight: TERMINAL_DRAWER_OFFSET } : undefined}
          >
            <div className={`${workspaceContentClass} h-full min-h-0`}>
              <TerminalPanel
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

            {terminalDrawerPresent ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-20"
                style={{ width: TERMINAL_DRAWER_WIDTH }}
              >
                <div
                  data-open={terminalDrawerVisible ? "true" : "false"}
                  className="motion-terminal-drawer pointer-events-auto h-full"
                >
                  <TerminalPanel
                    projectId={composerProjectId}
                    sessionPath={terminalSessionPath}
                    onClose={handleToggleTerminal}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
