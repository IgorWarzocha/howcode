import { formatReviewTargetLocation, type SavedReviewComment } from './review-model'

export function buildReviewPrompt({
  comments,
  instruction,
}: {
  comments: readonly SavedReviewComment[]
  instruction?: string | null | undefined
}) {
  const intro =
    typeof instruction === 'string' && instruction.trim().length > 0
      ? instruction.trim()
      : 'Address & fix these comments:'

  const bullets = comments
    .map(
      (comment, index) =>
        `${index + 1}. ${comment.purpose === 'rejection' ? '[Rejected] ' : ''}${formatReviewTargetLocation(comment.target)}\n   ${comment.body.trim()}`,
    )
    .join('\n\n')

  return `${intro}\n\n${bullets}`
}
