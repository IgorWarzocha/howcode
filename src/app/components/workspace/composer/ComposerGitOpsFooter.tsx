import { ArrowLeft } from "lucide-react";
import type { ProjectGitState } from "../../../desktop/types";
import { compactIconButtonClass, toolbarButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { PlainToggle } from "./PlainToggle";
import { formatGitCount } from "./git-ops";

type ComposerGitOpsFooterProps = {
  canCommit: boolean;
  diffCommentsSending: boolean;
  hasDiffComments: boolean;
  hasOrigin: boolean;
  includeUnstaged: boolean;
  isGitRepo: boolean;
  onBack: () => void;
  onPrimaryAction: () => void;
  onToggleIncludeUnstaged: () => void;
  onTogglePreview: () => void;
  onTogglePush: () => void;
  previewEnabled: boolean;
  primaryActionLabel: string;
  projectGitState: ProjectGitState | null;
  pushEnabled: boolean;
  runningPrimaryAction: boolean;
};

export function ComposerGitOpsFooter({
  canCommit,
  diffCommentsSending,
  hasDiffComments,
  hasOrigin,
  includeUnstaged,
  isGitRepo,
  onBack,
  onPrimaryAction,
  onToggleIncludeUnstaged,
  onTogglePreview,
  onTogglePush,
  previewEnabled,
  primaryActionLabel,
  projectGitState,
  pushEnabled,
  runningPrimaryAction,
}: ComposerGitOpsFooterProps) {
  return (
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
        <PlainToggle label="Unstaged" checked={includeUnstaged} onClick={onToggleIncludeUnstaged} />
        <PlainToggle label="Preview" checked={previewEnabled} onClick={onTogglePreview} />
        <PlainToggle
          label="Push"
          checked={pushEnabled}
          disabled={!hasOrigin}
          onClick={onTogglePush}
        />
      </div>

      <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
        {isGitRepo ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[color:var(--muted)]">
              {formatGitCount(projectGitState?.fileCount ?? 0)} files
            </span>
            <span
              className={
                (projectGitState?.insertions ?? 0) > 0
                  ? "text-[#7ee0bb]"
                  : "text-[color:var(--muted)]"
              }
            >
              +{formatGitCount(projectGitState?.insertions ?? 0)}
            </span>
            <span
              className={
                (projectGitState?.deletions ?? 0) > 0
                  ? "text-[#ff9c9c]"
                  : "text-[color:var(--muted)]"
              }
            >
              -{formatGitCount(projectGitState?.deletions ?? 0)}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          className={cn(
            toolbarButtonClass,
            "rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 text-[#1a1c26] hover:bg-[color:var(--accent)] hover:text-[#1a1c26] disabled:cursor-not-allowed disabled:opacity-45",
          )}
          onClick={() => {
            void onPrimaryAction();
          }}
          disabled={
            hasDiffComments
              ? diffCommentsSending
              : runningPrimaryAction || (isGitRepo ? !canCommit : false)
          }
          aria-label={primaryActionLabel}
        >
          {primaryActionLabel}
        </button>
      </div>
    </div>
  );
}
