import { useState } from 'react'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import { getErrorMessage } from '../desktop/error-messages'
import type { ComposerAttachment, DesktopActionInvoker, InboxThread } from '../desktop/types'
import { createInboxReplySubmission, getInboxReplyOutcome } from './inbox-reply'

export function useInboxReplyController(input: {
  isCompacting: boolean
  onAction: DesktopActionInvoker
  onDismissThread: (thread: InboxThread) => void
  streamingBehavior: Parameters<typeof createInboxReplySubmission>[0]['streamingBehavior']
  thread: InboxThread
}) {
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const send = async (sendInput?: {
    draft: string | undefined
    attachments: ComposerAttachment[]
  }) => {
    const submission = createInboxReplySubmission({
      attachments: sendInput?.attachments ?? attachments,
      draft: sendInput?.draft ?? draft,
      isCompacting: input.isCompacting,
      isSending,
      streamingBehavior: input.streamingBehavior,
      thread: input.thread,
    })
    if (!submission) return

    setIsSending(true)
    setErrorMessage(null)
    let outcome: ReturnType<typeof getInboxReplyOutcome>
    try {
      const result = await input.onAction('composer.send', submission.payload)
      outcome = getInboxReplyOutcome({
        isCompactCommand: submission.isCompactCommand,
        result,
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not send follow-up.'))
      return
    } finally {
      setIsSending(false)
    }

    if (outcome.kind === 'error') {
      setErrorMessage(outcome.message)
    } else if (outcome.kind !== 'stopped') {
      setDraft('')
      if (outcome.kind === 'reply-sent') {
        setAttachments([])
        input.onDismissThread(input.thread)
      }
    }
  }

  const stop = async () => {
    if (!input.thread.running || isSending) return

    setIsSending(true)
    setErrorMessage(null)
    try {
      const result = await input.onAction('composer.stop', {
        projectId: input.thread.projectId,
        sessionPath: input.thread.sessionPath,
      })
      const actionErrorMessage = getDesktopActionErrorMessage(result, 'Could not stop Pi.')
      if (actionErrorMessage) setErrorMessage(actionErrorMessage)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not stop Pi.'))
    } finally {
      setIsSending(false)
    }
  }

  return {
    attachments,
    draft,
    errorMessage,
    isSending,
    send,
    setAttachments,
    setDraft,
    setErrorMessage,
    stop,
  }
}

export type InboxReplyController = ReturnType<typeof useInboxReplyController>
