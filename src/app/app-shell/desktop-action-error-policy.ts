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
    action === 'workspace.commit' ||
    action === 'workspace.commit-options' ||
    action === 'workspace.diff-preferences' ||
    action === 'workspace.switch-branch' ||
    action === 'workspace.merge-worktree' ||
    action === 'workspace.merge-completed-worktrees'
  )
}
