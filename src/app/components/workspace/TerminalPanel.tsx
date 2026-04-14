import { GitBranch, SquareTerminal, X } from "lucide-react";
import { useRef } from "react";
import type { ProjectDiffBaseline, ProjectGitState } from "../../desktop/types";
import {
  type FeatureStatusId,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import {
  compactCardClass,
  compactIconButtonClass,
  iconButtonClass,
  panelChromeClass,
} from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { PiLogoMark } from "../common/PiLogoMark";
import { ToolbarButton } from "../common/ToolbarButton";
import { ComposerDiffBaselineSelector } from "./composer/ComposerDiffBaselineSelector";
import { getGitOpsEntryButtonClass } from "./composer/git-ops";
import { TerminalViewport } from "./terminal/TerminalViewport";

const PI_TUI_KEEP_ALIVE_MS = 300_000;

type TerminalPanelProps = {
  projectId: string;
  sessionPath: string | null;
  onClose: () => void;
  onOpenDockedTerminal?: () => void;
  onOpenGitOps?: () => void;
  mode?: "docked" | "takeover";
  projectGitState?: ProjectGitState | null;
  diffBaseline?: ProjectDiffBaseline;
  onSetDiffBaseline?: (baseline: ProjectDiffBaseline) => void;
};

export function TerminalPanel({
  projectId,
  sessionPath,
  onClose,
  onOpenDockedTerminal,
  onOpenGitOps,
  mode = "docked",
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
          keepAliveMsOnUnmount={PI_TUI_KEEP_ALIVE_MS}
          className="terminal-viewport--flush min-h-0 rounded-none bg-[color:var(--terminal-bg)]"
        />
        <div className="flex items-center gap-1.5 bg-[rgba(39,42,57,0.94)] px-4 pt-2 pb-3 text-[color:var(--muted)] backdrop-blur-[18px] max-md:flex-wrap">
          <ToolbarButton
            label="Desktop"
            icon={<PiLogoMark className="h-[14px] w-[14px]" />}
            onClick={onClose}
          />
          <ToolbarButton
            label="Terminal"
            icon={<SquareTerminal size={14} />}
            onClick={onOpenDockedTerminal}
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
                  "inline-flex px-2.5 py-1 text-[12px] text-[color:var(--muted)]",
                )}
                title={projectGitState.branch ?? "Detached"}
              >
                <span>{projectGitState.branch ?? "Detached"}</span>
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
    );
  }

  const panelClass = cn(panelChromeClass, "flex h-full min-h-0 flex-col gap-2.5 p-3");

  return (
    <section
      aria-label="Terminal panel"
      className={panelClass}
      {...getFeatureStatusDataAttributes(statusId)}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
          <SquareTerminal size={14} />
          <span className="font-medium text-[color:var(--text)]/90">Terminal</span>
          <FeatureStatusBadge statusId={statusId} />
        </div>
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Close terminal"
          title="Close terminal"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-[color:var(--terminal-bg)]">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="shell"
          preserveSessionOnUnmount
          className="bg-[color:var(--terminal-bg)]"
        />
      </div>
    </section>
  );
}
