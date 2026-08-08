import type { DesktopActionResult } from '../../desktop/types'
import { getReviewTargetLinesLabel, type SavedReviewComment } from './review/review-model'

export type GitOpsCommentCard = {
  id: string
  filePath: string
  fileName: string
  linesLabel: string
  body: string
}

export function getActionResultMessage(result: DesktopActionResult | null) {
  return typeof result?.result?.message === 'string' ? result.result.message : null
}

export function getActionResultCommitted(result: DesktopActionResult | null) {
  return result?.result?.committed === true
}

export function getActionResultPushed(result: DesktopActionResult | null) {
  return result?.result?.pushed === true
}

export function getActionResultPreviewed(result: DesktopActionResult | null) {
  return result?.result?.previewed === true
}

export function getActionResultError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === 'string' ? result.result.error : null
}

export function getCommentFileName(filePath: string) {
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
