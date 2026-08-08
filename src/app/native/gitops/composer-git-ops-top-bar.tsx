import { Tooltip } from '../../common/tooltip'
import { appToneMutedClass, appToneTextClass, appTypeTinyClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { GitOpsCommentCard } from './review/review-comment-card'

type ComposerGitOpsTopBarProps = {
  commentCards: GitOpsCommentCard[]
  onSelectDiffComment: (commentId: string) => void
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
              className={cn(
                'inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-0 transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
                appTypeTinyClass,
                appToneMutedClass,
              )}
              onClick={() => onSelectDiffComment(comment.id)}
              aria-label={`Open comment on ${comment.filePath} ${comment.linesLabel}`}
            >
              <span className={cn('max-w-40 truncate', appTypeTinyClass, appToneTextClass)}>
                {comment.fileName}
              </span>
              <span className={cn('shrink-0', appTypeTinyClass)}>{comment.linesLabel}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
