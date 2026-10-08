import type { DesktopAction } from '../desktop/actions'
import { cleanUserErrorMessage } from '../desktop/error-messages'
import type { DesktopActionResult } from '../desktop/types'

export function getActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (!actionResult) return null
  const error = actionResult.result?.error
  return typeof error === 'string' ? cleanUserErrorMessage(error) : null
}

export function shouldShowGlobalActionError(action: DesktopAction) {
  return !(
    action === 'composer.send' ||
    action === 'composer.stop' ||
    action === 'coding.commit' ||
    action === 'coding.commit-options' ||
    action === 'coding.diff-preferences' ||
    action === 'coding.switch-branch' ||
    action === 'coding.merge-worktree' ||
    action === 'coding.merge-completed-worktrees'
  )
}

export function getActionNoticeMessage(
  action: DesktopAction,
  actionResult: DesktopActionResult | null,
) {
  if (action === 'composer.dequeue' && actionResult?.ok) {
    if (actionResult.result?.queueCancelOutcome === 'already_placed')
      return 'This message has already been placed and cannot be canceled.'
    if (actionResult.result?.queueCancelOutcome === 'already_settled')
      return 'This message is no longer queued.'
  }
  const supportsWorktreeNotice =
    action === 'coding.create-worktree' ||
    action === 'coding.remove-worktree' ||
    action === 'coding.merge-worktree' ||
    action === 'coding.merge-completed-worktrees' ||
    action === 'coding.remove-completed-worktrees' ||
    action === 'coding.prune-branch'
  if (!(supportsWorktreeNotice && actionResult?.ok) || actionResult.result?.error) {
    return null
  }
  const message = actionResult.result?.message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}
