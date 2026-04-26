import { GitBranch, Github } from "lucide-react";
import type { ProjectGitState } from "../../../desktop/types";
import { compactCardClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { GitOpsCommentCard } from "./composer-git-ops.helpers";

type ComposerGitOpsTopBarProps = {
  commentCards: GitOpsCommentCard[];
  hasDiffComments: boolean;
  hasOrigin: boolean;
  isGitHubOrigin: boolean;
  isGitRepo: boolean;
  onSaveOrigin: () => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onSetRepoUrl: (repoUrl: string) => void;
  projectGitState: ProjectGitState | null;
  repoUrl: string;
};

export function ComposerGitOpsTopBar({
  commentCards,
  hasDiffComments,
  hasOrigin,
  isGitHubOrigin,
  isGitRepo,
  onSaveOrigin,
  onSelectDiffComment,
  onSetRepoUrl,
  projectGitState,
  repoUrl,
}: ComposerGitOpsTopBarProps) {
  return (
    <>
      <div className="absolute top-4 left-4 flex max-w-[calc(100%-18rem)] items-center gap-2">
        {isGitRepo ? (
          hasOrigin ? (
            <button
              type="button"
              className={cn(
                compactCardClass,
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] text-[color:var(--text)]",
              )}
              title={projectGitState?.originUrl ?? "origin"}
            >
              {isGitHubOrigin ? <Github size={12} /> : null}
              {projectGitState?.originName ?? "origin"}
            </button>
          ) : (
            <input
              value={repoUrl}
              onChange={(event) => onSetRepoUrl(event.target.value)}
              onBlur={() => {
                void onSaveOrigin();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSaveOrigin();
                }
              }}
              className={cn(
                compactCardClass,
                "w-64 bg-transparent px-2.5 py-1 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]",
              )}
              placeholder="Paste repository URL"
              aria-label="Repository URL"
            />
          )
        ) : null}

        {isGitRepo ? (
          <button
            type="button"
            className={cn(
              compactCardClass,
              "inline-flex items-center gap-1 px-2.5 py-1 text-[12px] text-[color:var(--muted)]",
            )}
            title="Branch switching will wire into this control later."
          >
            <GitBranch size={12} />
            <span>{projectGitState?.branch ?? "Detached"}</span>
          </button>
        ) : null}
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
    </>
  );
}
