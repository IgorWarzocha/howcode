import { isCompactSlashCommand } from '../../../../../shared/composer-slash-commands'
import { getDesktopActionErrorMessage } from '../../../desktop/action-results'
import { getErrorMessage } from '../../../desktop/error-messages'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../../../desktop/types'

type SubmitComposerDraftResult =
  | { status: 'skipped' }
  | { status: 'sent'; text: string }
  | { status: 'stopped'; text: string }
  | { status: 'error'; errorMessage: string; text: string }

type SubmitComposerDraftOptions = {
  draft: string
  attachments: ComposerAttachment[]
  isSending: boolean
  projectId: string
  chatGroupId?: string | null
  sessionPath: string | null
  streamingBehaviorPreference: ComposerStreamingBehavior
  onAction: DesktopActionInvoker
}

export async function submitComposerDraft({
  draft,
  attachments,
  isSending,
  projectId,
  chatGroupId = null,
  sessionPath,
  streamingBehaviorPreference,
  onAction,
}: SubmitComposerDraftOptions): Promise<SubmitComposerDraftResult> {
  const text = draft.trim()
  if ((text.length === 0 && attachments.length === 0) || isSending) {
    return { status: 'skipped' }
  }

  try {
    const sendAttachments = isCompactSlashCommand(text) ? [] : attachments
    const actionResult = await onAction('composer.send', {
      text,
      attachments: sendAttachments,
      projectId,
      chatGroupId,
      sessionPath,
      streamingBehavior: streamingBehaviorPreference,
    })

    const actionErrorMessage = getDesktopActionErrorMessage(actionResult, 'Could not send prompt.')
    if (actionErrorMessage) {
      return {
        status: 'error',
        errorMessage: actionErrorMessage,
        text,
      }
    }

    if (actionResult?.result?.composerSendOutcome === 'stopped') {
      return { status: 'stopped', text }
    }

    return { status: 'sent', text }
  } catch (error) {
    return {
      status: 'error',
      errorMessage: getErrorMessage(error, 'Could not send prompt.'),
      text,
    }
  }
}
