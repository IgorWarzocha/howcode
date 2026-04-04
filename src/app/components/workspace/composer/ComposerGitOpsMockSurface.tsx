import {
  ArrowLeft,
  Columns2,
  GitBranch,
  GitCompareArrows,
  Github,
  Rows3,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type { DesktopActionResult, ProjectGitState } from "../../../desktop/types";
import {
  compactIconButtonClass,
  diffPanelIconButtonClass,
  diffPanelTurnChipSelectedClass,
  toolbarButtonClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import type { SavedDiffComment } from "../diff/diffCommentStore";
import { formatGitCount } from "./git-ops-mock";

type ComposerGitOpsMockSurfaceProps = {
  projectGitState: ProjectGitState | null;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onBack: () => void;
};

function getActionResultMessage(result: DesktopActionResult | null) {
  return typeof result?.result?.message === "string" ? result.result.message : null;
}

function getActionResultCommitted(result: DesktopActionResult | null) {
  return result?.result?.committed === true;
}

function getActionResultPreviewed(result: DesktopActionResult | null) {
  return result?.result?.previewed === true;
}

function getActionResultError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === "string" ? result.result.error : null;
}

export function ComposerGitOpsMockSurface({
  projectGitState,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onBack,
}: ComposerGitOpsMockSurfaceProps) {
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitFocused, setCommitFocused] = useState(false);
  const [previewPendingCommit, setPreviewPendingCommit] = useState(false);
  const [persistedCleanMessage, setPersistedCleanMessage] = useState<string | null>(null);
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const previousProjectIdRef = useRef<string | null>(projectGitState?.projectId ?? null);
  const isGitRepo = projectGitState?.isGitRepo ?? false;
  const hasOrigin = projectGitState?.hasOrigin ?? false;
  const isGitHubOrigin = projectGitState?.originUrl?.includes("github.com") ?? false;
  const isTreeClean = isGitRepo && (projectGitState?.fileCount ?? 0) === 0;
  const hasDiffComments = diffComments.length > 0;
  const trimmedCommitMessage = commitMessage.trim();
  const canCommit =
    isGitRepo &&
    (includeUnstaged
      ? (projectGitState?.fileCount ?? 0) > 0
      : (projectGitState?.stagedFileCount ?? 0) > 0);
  const commitLabel = pushEnabled ? "Commit & push" : "Commit";
  const primaryActionLabel = hasDiffComments
    ? diffCommentsSending
      ? "Sending comments…"
      : "Send comments"
    : !isGitRepo
      ? "Init git"
      : canCommit || (projectGitState?.fileCount ?? 0) > 0
        ? commitLabel
        : "Clean";

  useEffect(() => {
    if (!hasOrigin) {
      setPushEnabled(false);
    }
  }, [hasOrigin]);

  useEffect(() => {
    const nextProjectId = projectGitState?.projectId ?? null;
    if (previousProjectIdRef.current === nextProjectId) {
      return;
    }

    previousProjectIdRef.current = nextProjectId;
    setCommitMessage("");
    setCommitFocused(false);
    setPersistedCleanMessage(null);
    setPreviewPendingCommit(false);
  }, [projectGitState]);

  useEffect(() => {
    if (!isTreeClean && persistedCleanMessage && commitMessage === persistedCleanMessage) {
      setCommitMessage("");
      setPersistedCleanMessage(null);
    }
  }, [commitMessage, isTreeClean, persistedCleanMessage]);

  const handleSaveOrigin = async () => {
    const nextRepoUrl = repoUrl.trim();
    if (!isGitRepo || nextRepoUrl.length === 0) {
      return;
    }

    try {
      await onAction("workspace.commit-options", { repoUrl: nextRepoUrl });
      setActionErrorMessage(null);
      setRepoUrl("");
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Could not update the repository remote.",
      );
    }
  };

  const handlePrimaryAction = async () => {
    if (hasDiffComments) {
      onSendDiffComments(trimmedCommitMessage);
      return;
    }

    if (runningPrimaryAction) {
      return;
    }

    if (!isGitRepo) {
      try {
        await onAction("workspace.commit-options");
        setActionErrorMessage(null);
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Could not initialize git.");
      }
      return;
    }

    if (!canCommit) {
      return;
    }

    const shouldPreview =
      previewEnabled && trimmedCommitMessage.length === 0 && !previewPendingCommit;

    setRunningPrimaryAction(true);

    try {
      setActionErrorMessage(null);
      const result = await onAction("workspace.commit", {
        includeUnstaged,
        message: trimmedCommitMessage.length > 0 ? trimmedCommitMessage : null,
        preview: shouldPreview,
        push: pushEnabled,
      });

      const nextMessage = getActionResultMessage(result);
      if (nextMessage) {
        setCommitMessage(nextMessage);
        setCommitFocused(false);
      }

      if (getActionResultPreviewed(result)) {
        setPreviewPendingCommit(true);
        return;
      }

      if (getActionResultCommitted(result)) {
        setPreviewPendingCommit(false);
        const finalMessage =
          nextMessage ?? (trimmedCommitMessage.length > 0 ? trimmedCommitMessage : null);
        if (finalMessage) {
          setCommitMessage(finalMessage);
          setPersistedCleanMessage(finalMessage);
        }
      }
      setActionErrorMessage(getActionResultError(result));
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Could not commit changes.");
    } finally {
      setRunningPrimaryAction(false);
    }
  };

  const commentCards = diffComments.map((comment) => ({
    id: comment.id,
    filePath: comment.filePath,
    fileName: getCommentFileName(comment.filePath),
    linesLabel: getCommentLinesLabel(comment),
  }));

  return (
    <div
      className="grid min-h-[189px] gap-0"
      data-feature-id="feature:composer.git-ops"
      data-feature-status="partial"
    >
      <div className="relative min-h-24">
        <div className="absolute top-4 left-4 flex max-w-[calc(100%-18rem)] items-center gap-2">
          {isGitRepo ? (
            hasOrigin ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[12px] text-[color:var(--text)]"
                title={projectGitState?.originUrl ?? "origin"}
              >
                {isGitHubOrigin ? <Github size={12} /> : null}
                {projectGitState?.originName ?? "origin"}
              </button>
            ) : (
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                onBlur={() => {
                  void handleSaveOrigin();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSaveOrigin();
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

          {isGitRepo ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[12px] text-[color:var(--muted)]"
              title="Branch switching will wire into this control later."
            >
              <GitBranch size={12} />
              <span>{projectGitState?.branch ?? "Detached"}</span>
            </button>
          ) : null}

          <FeatureStatusBadge statusId="feature:composer.git-ops" />
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === "stacked"
                ? diffPanelTurnChipSelectedClass
                : "border-[color:var(--border)] bg-transparent",
            )}
            onClick={() => onSetDiffRenderMode("stacked")}
            aria-label="Unified diff view"
            title="Unified diff view"
          >
            <Rows3 size={14} />
          </button>
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === "split"
                ? diffPanelTurnChipSelectedClass
                : "border-[color:var(--border)] bg-transparent",
            )}
            onClick={() => onSetDiffRenderMode("split")}
            aria-label="Split diff view"
            title="Split diff view"
          >
            <Columns2 size={14} />
          </button>
          <button
            type="button"
            className={cn(diffPanelIconButtonClass, "border-[color:var(--border)] bg-transparent")}
            onClick={() => onAction("diff.review")}
            aria-label="Diff panel actions"
            title="Diff panel actions"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {hasDiffComments ? (
          <div className="absolute right-4 bottom-3 left-4 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              {commentCards.map((comment) => (
                <button
                  key={comment.id}
                  type="button"
                  className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.035)] px-2 py-1 text-[11px] leading-none text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
                  onClick={() => onSelectDiffComment(comment.filePath, comment.id)}
                  title={`${comment.filePath} · ${comment.linesLabel}`}
                >
                  <span className="max-w-40 truncate text-[11px] font-normal text-[color:var(--text)]">
                    {comment.fileName}
                  </span>
                  <span className="shrink-0 text-[11px] font-normal">{comment.linesLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-3 max-md:flex-wrap">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            value={commitMessage}
            onChange={(event) => {
              const nextMessage = event.target.value;
              setCommitMessage(nextMessage);
              if (actionErrorMessage) {
                setActionErrorMessage(null);
              }
              if (nextMessage.trim().length === 0) {
                setPreviewPendingCommit(false);
              }
              if (persistedCleanMessage && nextMessage !== persistedCleanMessage) {
                setPersistedCleanMessage(null);
              }
            }}
            onFocus={() => setCommitFocused(true)}
            onBlur={() => setCommitFocused(false)}
            aria-label={hasDiffComments ? "Comment instructions" : "Commit message"}
            placeholder={
              commitFocused
                ? ""
                : hasDiffComments
                  ? "Address & fix these comments: "
                  : "Leave blank to autogenerate a commit message"
            }
          />
        </div>

        <div
          className={cn(
            "inline-flex h-8 items-center justify-end rounded-full text-right text-[12px] leading-5",
            actionErrorMessage || diffCommentError ? "text-[#f2a7a7]" : "invisible w-8",
          )}
          aria-live={actionErrorMessage || diffCommentError ? "polite" : undefined}
          aria-hidden={actionErrorMessage || diffCommentError ? undefined : true}
        >
          {actionErrorMessage ?? diffCommentError ?? <GitCompareArrows size={16} />}
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

        <div className="flex items-center gap-3">
          <PlainToggle
            label="Unstaged"
            checked={includeUnstaged}
            onClick={() => setIncludeUnstaged((current) => !current)}
          />
          <PlainToggle
            label="Preview"
            checked={previewEnabled}
            onClick={() => {
              setPreviewEnabled((current) => !current);
              setPreviewPendingCommit(false);
            }}
          />
          <PlainToggle
            label="Push"
            checked={pushEnabled}
            disabled={!hasOrigin}
            onClick={() => setPushEnabled((current) => !current)}
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
              void handlePrimaryAction();
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
    </div>
  );
}

function getCommentLinesLabel(comment: SavedDiffComment) {
  const endLineNumber = comment.endLineNumber ?? comment.lineNumber;
  const endSide = comment.endSide ?? comment.side;

  if (comment.side === endSide) {
    const start = Math.min(comment.lineNumber, endLineNumber);
    const end = Math.max(comment.lineNumber, endLineNumber);
    return start === end ? `Ln ${start}` : `Ln ${start}:${end}`;
  }

  return `Ln ${comment.lineNumber}:${endLineNumber}`;
}

function getCommentFileName(filePath: string) {
  const segments = filePath.split("/");
  return segments[segments.length - 1] || filePath;
}

function PlainToggle({
  checked,
  disabled = false,
  label,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 text-[12px] text-[color:var(--muted)] transition-colors",
        disabled ? "cursor-not-allowed opacity-45" : "hover:text-[color:var(--text)]",
      )}
      onClick={onClick}
      disabled={disabled}
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
