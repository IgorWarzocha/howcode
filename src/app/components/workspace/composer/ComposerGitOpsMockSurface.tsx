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
import { ghostButtonClass, primaryButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
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
  const canOpenDiff = gitOpsMockMode !== "not-git";
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
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(ghostButtonClass, "inline-flex items-center gap-1.5 px-2")}
            onClick={onBack}
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2 text-[14px] font-medium text-[color:var(--text)]">
            <span>Git ops</span>
            <FeatureStatusBadge statusId="feature:composer.git-ops" />
          </div>
        </div>

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
      </div>

      <div className="grid gap-3 px-4 pb-4">
        <div className="grid gap-3 rounded-[18px] border border-[color:var(--border)] bg-[rgba(18,20,28,0.32)] p-3">
          {gitOpsMockMode === "not-git" ? (
            <div className="rounded-xl border border-[rgba(255,110,110,0.2)] bg-[rgba(255,94,94,0.08)] px-3 py-2 text-[13px] font-medium text-[#ffd1d1]">
              <div className="flex items-center gap-2">
                <TriangleAlert size={14} />
                Not a git repository
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3 max-md:flex-col">
              <div className="mt-1 flex items-center gap-2 text-[13px] text-[color:var(--text)]">
                <GitBranch size={14} />
                <span>{meta.branch}</span>
              </div>

              <p
                className={cn(
                  "text-[13px]",
                  hasChanges ? "text-[#7ee0bb]" : "text-[color:var(--muted)]",
                )}
              >
                {changesSummary}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px] text-[color:var(--text)]">
            <span>Include unstaged</span>
            <button
              type="button"
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                includeUnstaged ? "bg-[color:var(--accent)]" : "bg-[rgba(255,255,255,0.14)]",
              )}
              onClick={() => setIncludeUnstaged((current) => !current)}
              aria-pressed={includeUnstaged}
              aria-label="Include unstaged changes"
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-[#1a1c26] transition-transform",
                  includeUnstaged ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {gitOpsMockMode === "not-git" ? null : hasChanges ? (
            <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Commit message
              </div>
              <textarea
                className="min-h-20 w-full resize-none bg-transparent text-[13px] leading-6 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                aria-label="Commit message"
                placeholder="Leave blank to autogenerate a commit message"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[rgba(92,201,165,0.2)] bg-[rgba(92,201,165,0.08)] px-3 py-2 text-[13px] text-[#bdf7dd]">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={14} />
                Working tree clean
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <button
            type="button"
            className={cn(
              ghostButtonClass,
              "inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2",
              !canOpenDiff && "cursor-not-allowed opacity-50",
            )}
            onClick={() => {
              if (!canOpenDiff) {
                return;
              }

              onOpenDiffPanel();
            }}
            disabled={!canOpenDiff}
          >
            <GitCompareArrows size={14} />
            Open diff
          </button>

          <div className="flex items-center gap-2 max-md:flex-col max-md:items-stretch">
            <button
              type="button"
              className={cn(
                ghostButtonClass,
                "rounded-xl border border-[color:var(--border)] px-3 py-2",
              )}
              onClick={() => void onAction("workspace.commit-options")}
            >
              Commit options
            </button>
            <button
              type="button"
              className={cn(
                primaryButtonClass,
                "inline-flex items-center justify-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-50",
              )}
              onClick={() => void onAction("workspace.commit")}
              disabled={!hasChanges || gitOpsMockMode === "not-git"}
            >
              <GitCommitHorizontal size={15} />
              Commit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
