import { isCompactSlashCommand } from '@howcode/shared/composer-slash-commands'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { getErrorMessage } from '../desktop/error-messages'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../desktop/types'
import {
  areSameAttachments,
  getComposerPostSendCleanup,
  isSameSubmittedDraft,
} from './composer-submission-cleanup'
import { composerDraftStore } from './composerDraftStore'
import { submitComposerDraft } from './submitComposerDraft'

type SubmitResult = Awaited<ReturnType<typeof submitComposerDraft>>

export function clearPendingSubmitted(input: {
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
}) {
  input.setPendingSubmittedDraft(null)
  input.pendingSubmittedReplyActivityKeyRef.current = null
}

function restoreSubmittedDraft(input: {
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  result: Extract<SubmitResult, { status: 'error' | 'stopped' }>
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  submittedAttachments: ComposerAttachment[]
  submittedRawDraft: string
  draftValueRef: MutableRefObject<string>
}) {
  if (
    isSameSubmittedDraft(input.draftValueRef.current, input.submittedRawDraft) &&
    areSameAttachments(input.attachmentsRef.current, input.submittedAttachments)
  ) {
    input.setDraftValue(input.result.text)
    input.setAttachments(input.submittedAttachments)
  }
}

function handleSentComposerResult(input: {
  activeDraftThreadIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  draftValueRef: MutableRefObject<string>
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  preserveAttachments: boolean
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  skipNextDraftPersistenceRef: MutableRefObject<string | null>
  submittedAttachments: ComposerAttachment[]
  submittedDraftThreadId: string | null
  submittedRawDraft: string
  submittedWhileStreaming: boolean
}) {
  const cleanup = getComposerPostSendCleanup({
    activeDraftThreadId: input.activeDraftThreadIdRef.current,
    submittedDraftThreadId: input.submittedDraftThreadId,
    preserveAttachments: input.preserveAttachments,
    currentDraft: input.draftValueRef.current,
    submittedRawDraft: input.submittedRawDraft,
    currentAttachments: input.attachmentsRef.current,
    submittedAttachments: input.submittedAttachments,
  })
  if (cleanup.clearStoredDraft && input.submittedDraftThreadId) {
    if (cleanup.skipNextDraftPersistence) {
      input.skipNextDraftPersistenceRef.current = input.submittedDraftThreadId
    }
    composerDraftStore.clearThreadDraft(input.submittedDraftThreadId)
  }
  if (cleanup.clearStoredPrompt && input.submittedDraftThreadId) {
    composerDraftStore.setPrompt(input.submittedDraftThreadId, '')
  }
  if (cleanup.nextAttachments !== null) input.setAttachments(cleanup.nextAttachments)
  if (
    input.submittedWhileStreaming &&
    input.activeDraftThreadIdRef.current === input.submittedDraftThreadId
  ) {
    clearPendingSubmitted(input)
    if (isSameSubmittedDraft(input.draftValueRef.current, input.submittedRawDraft)) {
      input.setDraftValue('')
    }
  }
}

function handleRestorableComposerResult(input: {
  activeDraftThreadIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  draftValueRef: MutableRefObject<string>
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  result: Extract<SubmitResult, { status: 'error' | 'stopped' }>
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  submittedAttachments: ComposerAttachment[]
  submittedDraftThreadId: string | null
  submittedRawDraft: string
}) {
  if (input.activeDraftThreadIdRef.current !== input.submittedDraftThreadId) return
  clearPendingSubmitted(input)
  restoreSubmittedDraft(input)
  if (input.result.status === 'error') input.setErrorMessage(input.result.errorMessage)
}

export async function runExtensionCommandSubmission(input: {
  activeComposerScopeKeyRef: MutableRefObject<string>
  chatGroupId: string | null
  composerScopeKey: string
  draftThreadId: string | null
  draftValueRef: MutableRefObject<string>
  onAction: DesktopActionInvoker
  projectId: string
  runId: number
  sessionPath: string | null
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setExtensionCommandRunning: Dispatch<SetStateAction<boolean>>
  extensionCommandRunIdRef: MutableRefObject<number>
  stopDictationAndFlush: () => Promise<void>
  streamingBehaviorPreference: ComposerStreamingBehavior
}) {
  try {
    await input.stopDictationAndFlush()
    if (input.activeComposerScopeKeyRef.current !== input.composerScopeKey) return
    const submittedDraft = input.draftValueRef.current.trim()
    if (submittedDraft.length === 0) return
    input.setDraftValue('')
    if (input.draftThreadId) composerDraftStore.setPrompt(input.draftThreadId, '')
    const result = await submitComposerDraft({
      draft: submittedDraft,
      attachments: [],
      isSending: false,
      projectId: input.projectId,
      chatGroupId: input.chatGroupId,
      sessionPath: input.sessionPath,
      streamingBehaviorPreference: input.streamingBehaviorPreference,
      onAction: input.onAction,
    })
    if (input.activeComposerScopeKeyRef.current !== input.composerScopeKey) return
    if (result.status === 'error') {
      input.setDraftValue(result.text)
      input.setErrorMessage(result.errorMessage)
    } else if (result.status === 'stopped') input.setDraftValue(result.text)
  } catch (error) {
    if (input.activeComposerScopeKeyRef.current === input.composerScopeKey) {
      input.setErrorMessage(getErrorMessage(error, 'Could not send prompt.'))
    }
  } finally {
    if (input.extensionCommandRunIdRef.current === input.runId) {
      input.setExtensionCommandRunning(false)
    }
  }
}

export async function runComposerSendSubmission(input: {
  activeComposerScopeKeyRef: MutableRefObject<string>
  activeDraftThreadIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  chatGroupId: string | null
  composerScopeKey: string
  draftThreadId: string | null
  draftValueRef: MutableRefObject<string>
  isStreaming: boolean
  onAction: DesktopActionInvoker
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  projectId: string
  replyActivityKey: string
  sessionPath: string | null
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  skipNextDraftPersistenceRef: MutableRefObject<string | null>
  stopDictationAndFlush: () => Promise<void>
  streamingBehaviorPreference: ComposerStreamingBehavior
}) {
  const submittedDraftThreadId = input.draftThreadId
  await input.stopDictationAndFlush()
  if (input.activeComposerScopeKeyRef.current !== input.composerScopeKey) return
  const submittedRawDraft = input.draftValueRef.current
  const submittedDraft = submittedRawDraft.trim()
  const submittedAttachments = input.attachmentsRef.current
  if (submittedDraft.length === 0 && submittedAttachments.length === 0) return
  input.setErrorMessage(null)
  input.setOpenMenu(null)
  input.pendingSubmittedReplyActivityKeyRef.current = input.replyActivityKey
  input.setPendingSubmittedDraft(submittedRawDraft)
  const result = await submitComposerDraft({
    draft: submittedDraft,
    attachments: submittedAttachments,
    isSending: false,
    projectId: input.projectId,
    chatGroupId: input.chatGroupId,
    sessionPath: input.sessionPath,
    streamingBehaviorPreference: input.streamingBehaviorPreference,
    onAction: input.onAction,
  })
  if (result.status === 'sent') {
    handleSentComposerResult({
      ...input,
      preserveAttachments: isCompactSlashCommand(submittedDraft),
      submittedAttachments,
      submittedDraftThreadId,
      submittedRawDraft,
      submittedWhileStreaming: input.isStreaming,
    })
  } else if (result.status === 'error' || result.status === 'stopped') {
    handleRestorableComposerResult({
      ...input,
      result,
      submittedAttachments,
      submittedDraftThreadId,
      submittedRawDraft,
    })
  }
}
