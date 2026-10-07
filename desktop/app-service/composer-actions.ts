import { isCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import {
  getBranchName,
  getComposerAttachments,
  getComposerModelSelection,
  getComposerQueueId,
  getComposerRequest,
  getComposerStreamingBehavior,
  getComposerText,
  getComposerThinkingLevel,
  getConversationFork,
} from '../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload, ComposerAttachment } from '../../shared/desktop-contracts.ts'
import {
  dequeueComposerPrompt,
  forkConversation,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  stopComposerRun,
} from '../conversation-runtime.ts'
import { assignThreadBranch, dismissInboxThreadAfterReply } from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'
import { normalizeComposerSendAttachments } from './composer-attachment-payload'

type ComposerActionHandler = (
  payload: AnyDesktopActionPayload,
) => Promise<ActionHandlerResult> | ActionHandlerResult

async function sendComposerPromptFromPayload(payload: AnyDesktopActionPayload) {
  const text = getComposerText(payload)
  let attachments: ComposerAttachment[] = []

  if (!isCompactSlashCommand(text)) {
    const normalizedAttachmentPayload = await normalizeComposerSendAttachments(
      getComposerAttachments(payload),
    )
    attachments = normalizedAttachmentPayload.attachments
    if (normalizedAttachmentPayload.rejected) {
      return handledAction({
        error: 'Could not send prompt because one or more attached files are no longer available.',
      })
    }
  }

  if (!text && attachments.length === 0) return handledAction()

  const composerRequest = getComposerRequest(payload)
  const composerSendResult = await sendComposerPrompt({
    ...composerRequest,
    text,
    attachments,
    streamingBehavior: getComposerStreamingBehavior(payload),
  })
  if (
    payload.suppressInbox === true &&
    composerRequest.conversationId &&
    composerSendResult.conversationId &&
    composerSendResult.threadId &&
    composerSendResult.outcome === 'sent' &&
    !isCompactSlashCommand(text)
  ) {
    dismissInboxThreadAfterReply(composerRequest.conversationId)
  }
  const branchName = getBranchName(payload) ?? composerRequest.branchName?.trim()
  if (composerSendResult.threadId && branchName) {
    assignThreadBranch(composerSendResult.threadId, branchName)
  }
  return handledAction({
    composerSendOutcome: composerSendResult.outcome,
    composerSendConversationId: composerSendResult.conversationId,
    composerSendThreadId: composerSendResult.threadId,
  })
}

async function dequeueComposerPromptFromPayload(payload: AnyDesktopActionPayload) {
  const queueId = getComposerQueueId(payload)
  if (!queueId) return handledAction()
  const queueCancelOutcome = await dequeueComposerPrompt({
    ...getComposerRequest(payload),
    queueId,
  })
  return handledAction({ queueCancelOutcome })
}

async function forkConversationFromPayload(payload: AnyDesktopActionPayload) {
  const fork = getConversationFork(payload)
  if (!fork) return handledAction({ error: 'Conversation entry is required.' })
  return handledAction(await forkConversation({ ...getComposerRequest(payload), ...fork }))
}

const composerActionHandlers = {
  'composer.model': async (payload) => {
    const selection = getComposerModelSelection(payload)
    if (selection)
      await setComposerModel(getComposerRequest(payload), selection.provider, selection.modelId)
    return handledAction()
  },
  'composer.thinking': async (payload) => {
    const level = getComposerThinkingLevel(payload)
    if (level) await setComposerThinkingLevel(getComposerRequest(payload), level)
    return handledAction()
  },
  'composer.send': sendComposerPromptFromPayload,
  'composer.stop': async (payload) => {
    await stopComposerRun(getComposerRequest(payload))
    return handledAction()
  },
  'composer.dequeue': dequeueComposerPromptFromPayload,
  'composer.conversation.fork': forkConversationFromPayload,
} satisfies Partial<Record<DesktopAction, ComposerActionHandler>>

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ComposerActionHandler>> = composerActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
