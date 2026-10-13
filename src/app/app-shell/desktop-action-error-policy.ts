import { cleanUserErrorMessage } from '@howaboua/howcode-sdk/errors'
import type { DesktopAction } from '../desktop/actions'
import type { DesktopActionResult } from '../desktop/types'
import { getGitRendererApi } from '../git-integration/client'

export function getActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (!actionResult) return null
  const error = actionResult.result?.error
  return typeof error === 'string' ? cleanUserErrorMessage(error) : null
}

export function shouldShowGlobalActionError(action: DesktopAction) {
  return !(
    action === 'composer.send' ||
    action === 'composer.stop' ||
    getGitRendererApi()?.handlesGitActionError(action)
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
  return null
}
