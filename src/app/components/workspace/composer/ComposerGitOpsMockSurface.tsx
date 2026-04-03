import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  GitPullRequestArrow,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import { compactIconButtonClass } from "../../../ui/classes";
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
  const [commitAndPush, setCommitAndPush] = useState(false);
  const [draft, setDraft] = useState(false);
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
      <textarea
        className="min-h-24 w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
        value={commitMessage}
        onChange={(event) => setCommitMessage(event.target.value)}
        aria-label="Commit message"
        placeholder="Leave blank to autogenerate a commit message"
      />

      <div className="flex items-center justify-between gap-2 px-4 pb-3 max-md:flex-wrap">
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--muted)]">
          {isGitRepo ? (
            <GitBranch size={14} />
          ) : (
            <TriangleAlert size={14} className="text-[#ff9c9c]" />
          )}
          <span>{isGitRepo ? meta.branch : "Not a git repository"}</span>
          <FeatureStatusBadge statusId="feature:composer.git-ops" />
        </div>

        <div className="flex items-center gap-2">
          {isGitRepo ? (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[color:var(--muted)]">{formatGitCount(meta.files)} files</span>
              <span className={hasChanges ? "text-[#7ee0bb]" : "text-[color:var(--muted)]"}>
                +{formatGitCount(meta.additions)}
              </span>
              <span className={hasChanges ? "text-[#ff9c9c]" : "text-[color:var(--muted)]"}>
                -{formatGitCount(meta.deletions)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
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
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() =>
              void onAction(isGitRepo ? "workspace.commit" : "workspace.commit-options")
            }
            disabled={!hasChanges && isGitRepo}
            aria-label={isGitRepo ? "Commit" : "Git setup"}
          >
            {isGitRepo ? <GitCommitHorizontal size={16} /> : <TriangleAlert size={16} />}
          </button>
        </div>
      </div>

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <button
          type="button"
          className={compactIconButtonClass}
          onClick={onBack}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>

        {gitOpsMockMode === "clean" ? (
          <div className="flex items-center gap-2 text-[13px] text-[#bdf7dd]">
            <CheckCircle2 size={14} />
            <span>Working tree clean</span>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5 max-md:flex-wrap">
          <ToolbarButton
            label={includeUnstaged ? "Include unstaged" : "Staged only"}
            icon={<GitCompareArrows size={14} />}
            onClick={() => setIncludeUnstaged((current) => !current)}
            className={includeUnstaged ? "text-[color:var(--text)]" : undefined}
          />
          <ToolbarButton
            label="Open diff"
            icon={<GitCompareArrows size={14} />}
            onClick={onOpenDiffPanel}
            className={!isGitRepo ? "opacity-50" : undefined}
            disabled={!isGitRepo}
          />
          <ToolbarButton
            label={commitAndPush ? "Commit & push" : "Commit only"}
            icon={<GitPullRequestArrow size={14} />}
            onClick={() => setCommitAndPush((current) => !current)}
            className={commitAndPush ? "text-[color:var(--text)]" : undefined}
          />
          <ToolbarButton
            label={draft ? "Draft" : "Ready"}
            icon={<GitCommitHorizontal size={14} />}
            onClick={() => setDraft((current) => !current)}
            className={draft ? "text-[color:var(--text)]" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
