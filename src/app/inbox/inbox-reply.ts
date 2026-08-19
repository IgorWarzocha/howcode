import { isCompactSlashCommand } from '@howcode/shared/composer-slash-commands'
import { getInboxThreadComposerMode } from '../common/inbox-thread-scope'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionResult,
  InboxThread,
} from '../desktop/types'

export function createInboxReplySubmission(input: {
  attachments: ComposerAttachment[]
  draft: string
  isCompacting: boolean
  isSending: boolean
  streamingBehavior: ComposerStreamingBehavior
  thread: InboxThread
}) {
  const text = input.draft.trim()
  if (
    input.isSending ||
    input.isCompacting ||
    (text.length === 0 && input.attachments.length === 0)
  ) {
    return null
  }

  const isCompactCommand = isCompactSlashCommand(text)
  return {
    isCompactCommand,
    payload: {
      projectId: input.thread.projectId,
      sessionPath: input.thread.sessionPath,
      text,
      attachments: isCompactCommand ? [] : input.attachments,
      suppressInbox: true,
      streamingBehavior: input.streamingBehavior,
      composerMode: getInboxThreadComposerMode(input.thread),
      branchName: input.thread.branchName,
    },
  }
}

export type InboxReplyOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'stopped' }
  | { kind: 'compact-sent' }
  | { kind: 'reply-sent' }

export function getInboxReplyOutcome(input: {
  isCompactCommand: boolean
  result: DesktopActionResult | null
}): InboxReplyOutcome {
  const errorMessage = getDesktopActionErrorMessage(input.result, 'Could not send follow-up.')
  if (errorMessage) return { kind: 'error', message: errorMessage }
  if (input.result?.result?.composerSendOutcome === 'stopped') return { kind: 'stopped' }
  return { kind: input.isCompactCommand ? 'compact-sent' : 'reply-sent' }
}
