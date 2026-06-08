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
  getNativeExtensionDialogAnswer,
  getNativeExtensionRequestId,
  getNativeExtensionShortcut,
  getProjectTrustDecision,
} from '../../shared/pi-thread-action-payloads.ts'
import {
  answerNativeExtensionDialog,
  dequeueComposerPrompt,
  invokeNativeExtensionShortcut,
  refreshComposerAfterProjectTrust,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  setProjectTrust,
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

async function invokeNativeExtensionShortcutFromPayload(payload: AnyDesktopActionPayload) {
  const shortcut = getNativeExtensionShortcut(payload)
  if (!shortcut) return handledAction()
  const result = await invokeNativeExtensionShortcut({ ...getComposerRequest(payload), shortcut })
  return result.ok ? handledAction() : handledAction({ error: 'Could not run native shortcut.' })
}

async function answerNativeExtensionDialogFromPayload(payload: AnyDesktopActionPayload) {
  const requestId = getNativeExtensionRequestId(payload)
  if (!requestId) return handledAction()
  const result = await answerNativeExtensionDialog({
    ...getComposerRequest(payload),
    requestId,
    ...getNativeExtensionDialogAnswer(payload),
  })
  return result?.ok
    ? handledAction()
    : handledAction({ error: 'Could not answer extension UI request.' })
}

async function setProjectTrustFromPayload(payload: AnyDesktopActionPayload) {
  const trusted = getProjectTrustDecision(payload)
  const composerRequest = getComposerRequest(payload)
  if (trusted === null || !composerRequest.projectId) return handledAction()

  await setProjectTrust({ ...composerRequest, trusted })
  await invalidateRuntimeHostSettings({ sessionPath: composerRequest.sessionPath })
  const composer = await refreshComposerAfterProjectTrust(composerRequest)
  return handledAction({ composer })
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
  'composer.answer-native-extension-dialog': answerNativeExtensionDialogFromPayload,
  'composer.native-extension-shortcut': invokeNativeExtensionShortcutFromPayload,
  'composer.set-project-trust': setProjectTrustFromPayload,
} satisfies Partial<Record<DesktopAction, ComposerActionHandler>>

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ComposerActionHandler>> = composerActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
