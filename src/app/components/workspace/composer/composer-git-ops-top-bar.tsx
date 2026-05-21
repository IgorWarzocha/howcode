import { Tooltip } from '../../common/tooltip'
import type { GitOpsCommentCard } from './composer-git-ops.helpers'

type ComposerGitOpsTopBarProps = {
  commentCards: GitOpsCommentCard[]
  onSelectDiffComment: (filePath: string, commentId: string) => void
}

export function ComposerGitOpsTopBar({
  commentCards,
  onSelectDiffComment,
}: ComposerGitOpsTopBarProps) {
  return (
    <div className="overflow-x-auto px-4 pt-3 pb-1">
      <div className="flex min-w-max items-center gap-2">
        {commentCards.map((comment) => (
          <Tooltip key={comment.id} content={comment.body || 'Open comment'}>
            <button
              type="button"
              className="inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-0 text-[11.5px] leading-4 text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={() => onSelectDiffComment(comment.filePath, comment.id)}
              aria-label={`Open comment on ${comment.filePath} ${comment.linesLabel}`}
            >
              <span className="max-w-40 truncate text-[11.5px] font-normal text-[color:var(--text)]">
                {comment.fileName}
              </span>
              <span className="shrink-0 text-[11.5px] font-normal">{comment.linesLabel}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
