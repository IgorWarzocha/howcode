import { getReviewTargetLinesLabel, type SavedReviewComment } from './review-model'

export type GitOpsCommentCard = {
  id: string
  filePath: string
  fileName: string
  linesLabel: string
  body: string
}

function getCommentFileName(filePath: string) {
  const segments = filePath.split('/')
  return segments[segments.length - 1] || filePath
}

export function buildGitOpsCommentCards(
  reviewComments: readonly SavedReviewComment[],
): GitOpsCommentCard[] {
  return reviewComments.map((comment) => ({
    id: comment.id,
    filePath: comment.target.filePath,
    fileName: getCommentFileName(comment.target.filePath),
    linesLabel: getReviewTargetLinesLabel(comment.target),
    body: comment.body,
  }))
}
