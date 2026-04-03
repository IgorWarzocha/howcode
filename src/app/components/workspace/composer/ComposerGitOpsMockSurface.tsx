import { ArrowLeft, GitBranch, GitCompareArrows, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import { compactIconButtonClass, primaryButtonClass } from "../../../ui/classes";
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
  const [pushEnabled, setPushEnabled] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [originKnown, setOriginKnown] = useState(true);
  const meta = gitOpsMockMeta[gitOpsMockMode];
  const isGitRepo = gitOpsMockMode !== "not-git";
  const canCommit = gitOpsMockMode === "dirty";
  const commitLabel = pushEnabled ? "Commit & push" : "Commit";

  return (
    <div
      className="grid min-h-[189px] gap-0"
      data-feature-id="feature:composer.git-ops"
      data-feature-status="mock"
    >
      <div className="relative">
        <textarea
          className="min-h-24 w-full resize-none bg-transparent px-4 pt-4 pb-2 pr-56 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none"
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          aria-label="Commit message"
          placeholder=""
        />

        <div className="pointer-events-none absolute bottom-2 left-4 text-[12px] leading-5 text-[color:var(--muted)]">
          Leave blank to autogenerate a commit message
        </div>

        <div className="absolute top-4 left-4 flex max-w-[calc(100%-18rem)] items-center gap-2">
          {isGitRepo ? (
            originKnown ? (
              <button
                type="button"
                className="rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[12px] text-[color:var(--text)]"
                onClick={() => setOriginKnown(false)}
                title="Mock: click to preview missing origin"
              >
                howcode
              </button>
            ) : (
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                onBlur={() => {
                  if (repoUrl.trim().length > 0) {
                    setOriginKnown(true);
                  }
                }}
                className="w-64 rounded-lg border border-[color:var(--border)] bg-transparent px-2.5 py-1 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                placeholder="Paste repository URL"
                aria-label="Repository URL"
              />
            )
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-[#ff9c9c]">
              <TriangleAlert size={14} />
              <span>Not a git repository</span>
            </div>
          )}
          <FeatureStatusBadge statusId="feature:composer.git-ops" />
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
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

          <ToolbarButton
            label="Open diff"
            icon={<GitCompareArrows size={14} />}
            onClick={onOpenDiffPanel}
            className={!isGitRepo ? "opacity-50" : undefined}
            disabled={!isGitRepo}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-3 max-md:flex-wrap">
        <div className="invisible flex items-center gap-1.5 max-md:flex-wrap">
          <ToolbarButton label="Placeholder" icon={<GitCompareArrows size={16} />} />
        </div>

        <button
          type="button"
          className="invisible inline-flex h-8 w-8 items-center justify-center rounded-full"
          aria-hidden="true"
          tabIndex={-1}
        >
          <GitCompareArrows size={16} />
        </button>
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

        <div className="flex items-center gap-3">
          <PlainToggle
            label="Include unstaged"
            checked={includeUnstaged}
            onClick={() => setIncludeUnstaged((current) => !current)}
          />
          <PlainToggle
            label="Push"
            checked={pushEnabled}
            onClick={() => setPushEnabled((current) => !current)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
          {isGitRepo ? (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[color:var(--muted)]">{meta.branch}</span>
              <span className="text-[color:var(--muted)]">{formatGitCount(meta.files)} files</span>
              <span className={meta.additions > 0 ? "text-[#7ee0bb]" : "text-[color:var(--muted)]"}>
                +{formatGitCount(meta.additions)}
              </span>
              <span className={meta.deletions > 0 ? "text-[#ff9c9c]" : "text-[color:var(--muted)]"}>
                -{formatGitCount(meta.deletions)}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "inline-flex h-8 items-center justify-center rounded-full px-4 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={() =>
              void onAction(isGitRepo ? "workspace.commit" : "workspace.commit-options")
            }
            disabled={!canCommit}
            aria-label={canCommit ? commitLabel : isGitRepo ? "Clean" : "Init git"}
          >
            {canCommit ? commitLabel : isGitRepo ? "Clean" : "Init git"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlainToggle({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
      onClick={onClick}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-[color:var(--accent)]" : "bg-[rgba(255,255,255,0.14)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-[#1a1c26] transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}
