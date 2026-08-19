import type { DesktopActionResult } from '../../desktop/types'

type CommitScope = {
  fileCount: number
  includeUnstaged: boolean
  includeUntracked: boolean
  stagedFileCount: number
  untrackedFileCount: number
}

export function getCommittableFileCount(input: CommitScope) {
  if (!input.includeUnstaged) return input.stagedFileCount
  return input.includeUntracked
    ? input.fileCount
    : Math.max(0, input.fileCount - input.untrackedFileCount)
}

export function canCommitGitOps(input: CommitScope & { isGitRepo: boolean }) {
  return input.isGitRepo && getCommittableFileCount(input) > 0
}

export function getPrimaryGitOpsActionLabel(input: {
  canCommit: boolean
  diffCommentsSending: boolean
  hasDiffComments: boolean
  isGitRepo: boolean
  pushEnabled: boolean
}) {
  if (input.hasDiffComments)
    return input.diffCommentsSending ? 'Sending comments…' : 'Send comments'
  if (!input.isGitRepo) return 'Init git'
  if (input.canCommit) return input.pushEnabled ? 'Commit & push' : 'Commit'
  return 'Clean'
}

export type GitOpsCommitOutcome = {
  committed: boolean
  errorMessage: string | null
  nextMessage: string | null
  persistedMessage: string | null
  previewed: boolean
  statusMessage: string | null
}

export function getGitOpsCommitOutcome(
  result: DesktopActionResult | null,
  submittedMessage: string,
): GitOpsCommitOutcome {
  const nextMessage = typeof result?.result?.message === 'string' ? result.result.message : null
  const previewed = result?.result?.previewed === true
  // Preview is the first stage of the existing two-step commit flow, even if a malformed
  // backend result also carries terminal fields.
  const committed = !previewed && result?.result?.committed === true
  const errorMessage =
    !previewed && typeof result?.result?.error === 'string' ? result.result.error : null
  const persistedMessage = committed ? (nextMessage ?? submittedMessage) || null : null
  const statusMessage =
    committed && !errorMessage
      ? result?.result?.pushed === true
        ? 'Committed and pushed successfully.'
        : 'Committed successfully.'
      : null

  return {
    committed,
    errorMessage,
    nextMessage,
    persistedMessage,
    previewed,
    statusMessage,
  }
}
