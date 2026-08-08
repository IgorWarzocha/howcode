import type { SavedReviewComment } from './review-model'

export type GitOpsReviewController = {
  comments: readonly SavedReviewComment[]
  error: string | null
  sending: boolean
  hasPendingReview: boolean
  selection: {
    commentId: string | null
    jumpKey: number
  }
  discard: () => void
  select: (commentId: string) => void
  send: (instruction?: string | null) => Promise<boolean>
}
