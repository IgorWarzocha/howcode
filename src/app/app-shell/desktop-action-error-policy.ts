import { cleanUserErrorMessage } from '@howaboua/howcode-sdk/errors'
import type { DesktopAction } from '../desktop/actions'
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
    action === 'git.commit' ||
    action === 'git.commit-options' ||
    action === 'git.diff-preferences' ||
    action === 'git.switch-branch' ||
    action === 'worktrees.merge-worktree' ||
    action === 'worktrees.merge-completed-worktrees'
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
    action === 'worktrees.create-worktree' ||
    action === 'worktrees.remove-worktree' ||
    action === 'worktrees.merge-worktree' ||
    action === 'worktrees.merge-completed-worktrees' ||
    action === 'worktrees.remove-completed-worktrees' ||
    action === 'worktrees.prune-branch'
  if (!(supportsWorktreeNotice && actionResult?.ok) || actionResult.result?.error) {
    return null
  }
  const message = actionResult.result?.message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}
