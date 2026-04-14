import { GitBranch, SquareTerminal, X } from "lucide-react";
import { useRef } from "react";
import type { ProjectDiffBaseline, ProjectGitState } from "../../desktop/types";
import {
  type FeatureStatusId,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import { compactIconButtonClass, iconButtonClass, panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { PiLogoMark } from "../common/PiLogoMark";
import { SurfacePanel } from "../common/SurfacePanel";
import { ToolbarButton } from "../common/ToolbarButton";
import { ComposerDiffBaselineSelector } from "./composer/ComposerDiffBaselineSelector";
import { getGitOpsEntryButtonClass } from "./composer/git-ops";
import { TerminalViewport } from "./terminal/TerminalViewport";

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
      <SurfacePanel
        ref={panelRef}
        aria-label="Pi terminal panel"
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] gap-0 overflow-hidden border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
        {...getFeatureStatusDataAttributes(statusId)}
      >
        <div className="min-h-0 px-4 pt-4 pb-3">
          <TerminalViewport
            projectId={projectId}
            sessionPath={sessionPath}
            launchMode="pi-session"
            className="min-h-0 rounded-[16px] border-[rgba(137,146,183,0.08)] bg-[rgba(23,25,35,0.98)]"
          />
        </div>
        <div className="h-px bg-[rgba(169,178,215,0.07)]" />
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
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
      </SurfacePanel>
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
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-[rgba(137,146,183,0.06)] bg-[rgba(23,25,35,0.98)] p-1">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="shell"
          preserveSessionOnUnmount
        />
      </div>
    </section>
  );
}
