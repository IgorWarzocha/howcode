import { GitBranch, PanelRightClose, SquareTerminal } from "lucide-react";
import { useRef } from "react";
import type { ProjectDiffBaseline, ProjectGitState } from "../../desktop/types";
import {
  type FeatureStatusId,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import { compactCardClass, compactIconButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { PiLogoMark } from "../common/PiLogoMark";
import { ToolbarButton } from "../common/ToolbarButton";
import { ComposerDiffBaselineSelector } from "./composer/ComposerDiffBaselineSelector";
import { getGitOpsEntryButtonClass } from "./composer/git-ops";
import { TerminalViewport } from "./terminal/TerminalViewport";

const PI_TUI_KEEP_ALIVE_MS = 300_000;
const PI_TUI_SESSION_FILE_IDLE_POLL_MS = 5 * 60_000;

type TerminalPanelProps = {
  projectId: string;
  sessionPath: string | null;
  onClose: () => void;
  onOpenDrawerTerminal?: () => void;
  onOpenGitOps?: () => void;
  mode?: "drawer" | "takeover";
  projectGitState?: ProjectGitState | null;
  diffBaseline?: ProjectDiffBaseline;
  onSetDiffBaseline?: (baseline: ProjectDiffBaseline) => void;
};

export function TerminalPanel({
  projectId,
  sessionPath,
  onClose,
  onOpenDrawerTerminal,
  onOpenGitOps,
  mode = "drawer",
  projectGitState = null,
  diffBaseline,
  onSetDiffBaseline,
}: TerminalPanelProps) {
  const statusId: FeatureStatusId = "feature:terminal.panel";
  const panelRef = useRef<HTMLDivElement>(null);
  const gitVisualMode = !projectGitState?.isGitRepo
    ? "not-git"
    : projectGitState.fileCount > 0
      ? "dirty"
      : "clean";

  if (mode === "takeover") {
    return (
      <div
        ref={panelRef}
        aria-label="Pi terminal panel"
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-transparent"
        {...getFeatureStatusDataAttributes(statusId)}
      >
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="pi-session"
          onProcessExit={onClose}
          keepAliveMsOnUnmount={PI_TUI_KEEP_ALIVE_MS}
          closeWhenSessionFileIdleMs={PI_TUI_SESSION_FILE_IDLE_POLL_MS}
          backgroundCssVar="--workspace"
          className="terminal-viewport--flush min-h-0 rounded-none bg-[color:var(--workspace)]"
        />
        <div className="overflow-hidden rounded-b-[20px] border-x border-b border-[color:var(--border)] bg-[rgba(39,42,57,0.94)] shadow-[var(--shadow)]">
          <div className="h-px bg-[rgba(169,178,215,0.07)]" />
          <div className="flex items-center gap-1.5 rounded-b-[20px] px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
            <ToolbarButton
              label="Desktop"
              icon={<PiLogoMark className="h-[14px] w-[14px]" />}
              onClick={onClose}
            />
            <ToolbarButton
              label="Terminal"
              icon={<SquareTerminal size={14} />}
              onClick={onOpenDrawerTerminal}
            />
            <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
              {projectGitState?.isGitRepo && diffBaseline && onSetDiffBaseline ? (
                <ComposerDiffBaselineSelector
                  composerPanelRef={panelRef}
                  projectId={projectId}
                  projectGitState={projectGitState}
                  selectedBaseline={diffBaseline}
                  onSelectBaseline={onSetDiffBaseline}
                />
              ) : null}
              {projectGitState?.isGitRepo ? (
                <div
                  className={cn(
                    compactCardClass,
                    "inline-flex max-w-[12rem] px-2.5 py-1 text-[12px] text-[color:var(--muted)]",
                  )}
                  title={projectGitState.branch ?? "Detached"}
                >
                  <span className="truncate">{projectGitState.branch ?? "Detached"}</span>
                </div>
              ) : null}
              <button
                type="button"
                className={cn(compactIconButtonClass, getGitOpsEntryButtonClass(gitVisualMode))}
                onClick={onOpenGitOps}
                aria-label="Open desktop git ops"
                title="Open desktop git ops"
              >
                <GitBranch size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Terminal drawer"
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden border-l border-[rgba(169,178,215,0.08)] bg-[color:var(--workspace)]"
      {...getFeatureStatusDataAttributes(statusId)}
    >
      <div className="flex h-11 items-center justify-between gap-3 border-b border-[rgba(169,178,215,0.08)] px-3">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-[color:var(--text)]">
          <SquareTerminal size={15} className="shrink-0 text-[color:var(--muted)]" />
          <span className="truncate font-medium">Terminal</span>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
          aria-label="Hide terminal"
          title="Hide terminal"
          onClick={onClose}
        >
          <PanelRightClose size={14} />
        </button>
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[color:var(--sidebar)]">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="shell"
          onProcessExit={onClose}
          preserveSessionOnUnmount
          backgroundCssVar="--sidebar"
          className="terminal-viewport--flush terminal-viewport--bottom-reserve absolute inset-0 h-auto min-h-0 rounded-none bg-[color:var(--sidebar)]"
        />
      </div>
    </section>
  );
}
