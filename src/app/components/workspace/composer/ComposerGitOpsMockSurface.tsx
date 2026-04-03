import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import { primaryButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import { ToolbarButton } from "../../common/ToolbarButton";
import {
  type GitOpsMockMode,
  formatGitCount,
  getGitOpsModeLabel,
  gitOpsMockMeta,
  gitOpsMockModes,
} from "./git-ops-mock";

type ComposerGitOpsMockSurfaceProps = {
  gitOpsMockMode: GitOpsMockMode;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onOpenDiffPanel: () => void;
  onSetGitOpsMockMode: (mode: GitOpsMockMode) => void;
};

export function ComposerGitOpsMockSurface({
  gitOpsMockMode,
  onAction,
  onBack,
  onOpenDiffPanel,
  onSetGitOpsMockMode,
}: ComposerGitOpsMockSurfaceProps) {
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const meta = gitOpsMockMeta[gitOpsMockMode];
  const hasChanges = gitOpsMockMode === "dirty";
  const isGitRepo = gitOpsMockMode !== "not-git";
  const changesSummary = useMemo(
    () =>
      `${formatGitCount(meta.files)} files  +${formatGitCount(meta.additions)}  -${formatGitCount(meta.deletions)}`,
    [meta.additions, meta.deletions, meta.files],
  );

  return (
    <div
      className="grid gap-0"
      data-feature-id="feature:composer.git-ops"
      data-feature-status="mock"
    >
      <div className="min-h-24 w-full px-4 pt-4 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)]">
        <div className="flex items-center gap-2">
          {isGitRepo ? (
            <GitBranch size={14} />
          ) : (
            <TriangleAlert size={14} className="text-[#ff9c9c]" />
          )}
          <span>{isGitRepo ? meta.branch : "Not a git repository"}</span>
          <FeatureStatusBadge statusId="feature:composer.git-ops" />
        </div>
        <div className="mt-2 text-[13px] text-[color:var(--muted)]">
          {isGitRepo ? changesSummary : "Initialize git to enable diff and commit flows."}
        </div>

        {hasChanges ? (
          <textarea
            className="mt-3 min-h-14 w-full resize-none bg-transparent text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            aria-label="Commit message"
            placeholder="Leave blank to autogenerate a commit message"
          />
        ) : gitOpsMockMode === "clean" ? (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[#bdf7dd]">
            <CheckCircle2 size={14} />
            <span>Working tree clean</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-3 max-md:flex-wrap">
        <div className="flex items-center gap-1.5 max-md:flex-wrap">
          <ToolbarButton label="Back" icon={<ArrowLeft size={14} />} onClick={onBack} />
          <ToolbarButton
            label={includeUnstaged ? "Include unstaged" : "Staged only"}
            icon={<GitCompareArrows size={14} />}
            onClick={() => setIncludeUnstaged((current) => !current)}
          />
        </div>

        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => void onAction(isGitRepo ? "workspace.commit" : "workspace.commit-options")}
          disabled={!hasChanges && isGitRepo}
          aria-label={isGitRepo ? "Commit" : "Git setup"}
        >
          {isGitRepo ? <GitCommitHorizontal size={16} /> : <TriangleAlert size={16} />}
        </button>
      </div>

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <ToolbarButton
          label="Open diff"
          icon={<GitCompareArrows size={14} />}
          onClick={onOpenDiffPanel}
          className={!isGitRepo ? "opacity-50" : undefined}
          disabled={!isGitRepo}
        />
        <ToolbarButton
          label="Commit options"
          icon={<GitCommitHorizontal size={14} />}
          onClick={() => void onAction("workspace.commit-options")}
          className={!isGitRepo ? "opacity-50" : undefined}
          disabled={!isGitRepo}
        />
        <div className="ml-auto flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
          {gitOpsMockModes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                mode === gitOpsMockMode
                  ? "bg-[rgba(255,255,255,0.08)] text-[color:var(--text)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
              )}
              onClick={() => onSetGitOpsMockMode(mode)}
            >
              {getGitOpsModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
