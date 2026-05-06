import { isCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload, ComposerAttachment } from '../../shared/desktop-contracts.ts'
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerQueueId,
  getComposerQueueMode,
  getComposerQueueSnapshotKey,
  getComposerRequest,
  getComposerStreamingBehavior,
  getComposerText,
  getComposerThinkingLevel,
  getNativeAskQuestionsAnswers,
  getNativeAskQuestionsRequestId,
} from '../../shared/pi-thread-action-payloads.ts'
import {
  answerNativeAskQuestions,
  dequeueComposerPrompt,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  stopComposerRun,
} from '../pi-desktop-runtime.ts'
import { invalidateRuntimeHostSettings } from '../runtime-host/client-bridge.ts'
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

  const composerSendResult = await sendComposerPrompt({
    ...getComposerRequest(payload),
    text,
    attachments,
    streamingBehavior: getComposerStreamingBehavior(payload),
  })
  return handledAction({
    composerSendOutcome: composerSendResult.outcome,
    composerSendSessionPath: composerSendResult.sessionPath,
    composerSendThreadId: composerSendResult.threadId,
  })
}

async function dequeueComposerPromptFromPayload(payload: AnyDesktopActionPayload) {
  const queueId = getComposerQueueId(payload)
  const queueMode = getComposerQueueMode(payload)
  const queueSnapshotKey = getComposerQueueSnapshotKey(payload)

  if (!(queueId && queueMode && queueSnapshotKey)) return handledAction()

  const dequeuedText = await dequeueComposerPrompt({
    ...getComposerRequest(payload),
    queueId,
    queueSnapshotKey,
    queueMode,
  })

  return handledAction({ dequeuedText })
}

async function answerNativeQuestionsFromPayload(payload: AnyDesktopActionPayload) {
  const requestId = getNativeAskQuestionsRequestId(payload)
  if (!requestId) return handledAction()
  const result = await answerNativeAskQuestions({
    ...getComposerRequest(payload),
    requestId,
    answers: getNativeAskQuestionsAnswers(payload),
  })
  return result?.ok
    ? handledAction()
    : handledAction({ error: 'Could not answer pending questions.' })
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
  'composer.reload-settings': async (payload) => {
    await invalidateRuntimeHostSettings({ sessionPath: getComposerRequest(payload).sessionPath })
    return handledAction()
  },
  'composer.answer-native-questions': answerNativeQuestionsFromPayload,
} satisfies Partial<Record<DesktopAction, ComposerActionHandler>>

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ComposerActionHandler>> = composerActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
