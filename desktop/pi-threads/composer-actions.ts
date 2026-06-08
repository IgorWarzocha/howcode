import { isCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload, ComposerAttachment } from '../../shared/desktop-contracts.ts'
import {
  getBranchName,
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
  getNativeExtensionShortcut,
  getSessionTreeLabel,
  getSessionTreeNavigate,
} from '../../shared/pi-thread-action-payloads.ts'
import {
  answerNativeAskQuestions,
  dequeueComposerPrompt,
  invokeNativeExtensionShortcut,
  labelSessionTreeEntry,
  navigateSessionTree,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  stopComposerRun,
} from '../pi-desktop-runtime.ts'
import { invalidateRuntimeHostSettings } from '../runtime-host/client-bridge.ts'
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
    composerRequest.sessionPath &&
    composerSendResult.sessionPath &&
    composerSendResult.threadId &&
    composerSendResult.outcome === 'sent' &&
    !isCompactSlashCommand(text)
  ) {
    dismissInboxThreadAfterReply(composerRequest.sessionPath)
  }
  const branchName = getBranchName(payload) ?? composerRequest.branchName?.trim()
  if (composerSendResult.threadId && branchName) {
    assignThreadBranch(composerSendResult.threadId, branchName)
  }
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

async function invokeNativeExtensionShortcutFromPayload(payload: AnyDesktopActionPayload) {
  const shortcut = getNativeExtensionShortcut(payload)
  if (!shortcut) return handledAction()
  const result = await invokeNativeExtensionShortcut({ ...getComposerRequest(payload), shortcut })
  return result.ok ? handledAction() : handledAction({ error: 'Could not run native shortcut.' })
}

async function navigateSessionTreeFromPayload(payload: AnyDesktopActionPayload) {
  const navigate = getSessionTreeNavigate(payload)
  if (!navigate) return handledAction({ error: 'Session tree entry is required.' })
  try {
    const result = await navigateSessionTree({
      ...getComposerRequest(payload),
      targetEntryId: navigate.targetEntryId,
      summarize: navigate.summarize,
      label: navigate.label,
    })
    if (result.cancelled) return handledAction({ sessionTreeNavigateCancelled: true })
    return handledAction({
      ...(result.editorText === undefined
        ? {}
        : { sessionTreeNavigateEditorText: result.editorText }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return handledAction({ error: message })
  }
}

async function labelSessionTreeEntryFromPayload(payload: AnyDesktopActionPayload) {
  const labelRequest = getSessionTreeLabel(payload)
  if (!labelRequest) return handledAction({ error: 'Session tree entry is required.' })
  try {
    await labelSessionTreeEntry({
      ...getComposerRequest(payload),
      targetEntryId: labelRequest.targetEntryId,
      label: labelRequest.label,
    })
    return handledAction()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return handledAction({ error: message })
  }
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
  'composer.native-extension-shortcut': invokeNativeExtensionShortcutFromPayload,
  'composer.session-tree.label': labelSessionTreeEntryFromPayload,
  'composer.session-tree.navigate': navigateSessionTreeFromPayload,
} satisfies Partial<Record<DesktopAction, ComposerActionHandler>>

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ComposerActionHandler>> = composerActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
