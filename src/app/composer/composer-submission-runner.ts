import { isCompactSlashCommand } from '@howcode/shared/composer-slash-commands'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
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
  activeDraftChatIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  draftValueRef: MutableRefObject<string>
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  preserveAttachments: boolean
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  skipNextDraftPersistenceRef: MutableRefObject<string | null>
  submittedAttachments: ComposerAttachment[]
  submittedDraftChatId: string | null
  submittedRawDraft: string
  submittedWhileStreaming: boolean
}) {
  const cleanup = getComposerPostSendCleanup({
    activeDraftChatId: input.activeDraftChatIdRef.current,
    submittedDraftChatId: input.submittedDraftChatId,
    preserveAttachments: input.preserveAttachments,
    currentDraft: input.draftValueRef.current,
    submittedRawDraft: input.submittedRawDraft,
    currentAttachments: input.attachmentsRef.current,
    submittedAttachments: input.submittedAttachments,
  })
  if (cleanup.clearStoredDraft && input.submittedDraftChatId) {
    if (cleanup.skipNextDraftPersistence) {
      input.skipNextDraftPersistenceRef.current = input.submittedDraftChatId
    }
    composerDraftStore.clearChatDraft(input.submittedDraftChatId)
  }
  if (cleanup.clearStoredPrompt && input.submittedDraftChatId) {
    composerDraftStore.setPrompt(input.submittedDraftChatId, '')
  }
  if (cleanup.nextAttachments !== null) input.setAttachments(cleanup.nextAttachments)
  if (
    input.submittedWhileStreaming &&
    input.activeDraftChatIdRef.current === input.submittedDraftChatId
  ) {
    clearPendingSubmitted(input)
    if (isSameSubmittedDraft(input.draftValueRef.current, input.submittedRawDraft)) {
      input.setDraftValue('')
    }
  }
}

function handleRestorableComposerResult(input: {
  activeDraftChatIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  draftValueRef: MutableRefObject<string>
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  result: Extract<SubmitResult, { status: 'error' | 'stopped' }>
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  submittedAttachments: ComposerAttachment[]
  submittedDraftChatId: string | null
  submittedRawDraft: string
}) {
  if (input.activeDraftChatIdRef.current !== input.submittedDraftChatId) return
  clearPendingSubmitted(input)
  restoreSubmittedDraft(input)
  if (input.result.status === 'error') input.setErrorMessage(input.result.errorMessage)
}

export async function runComposerSendSubmission(input: {
  activeComposerScopeKeyRef: MutableRefObject<string>
  activeDraftChatIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  workspaceId: string | null
  composerScopeKey: string
  draftChatId: string | null
  draftValueRef: MutableRefObject<string>
  isStreaming: boolean
  onAction: DesktopActionInvoker
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  directoryId: string
  replyActivityKey: string
  conversationId: string | null
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  skipNextDraftPersistenceRef: MutableRefObject<string | null>
  stopDictationAndFlush: () => Promise<void>
  streamingBehaviorPreference: ComposerStreamingBehavior
}) {
  const submittedDraftChatId = input.draftChatId
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
    directoryId: input.directoryId,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    streamingBehaviorPreference: input.streamingBehaviorPreference,
    onAction: input.onAction,
  })
  if (result.status === 'sent') {
    handleSentComposerResult({
      ...input,
      preserveAttachments: isCompactSlashCommand(submittedDraft),
      submittedAttachments,
      submittedDraftChatId,
      submittedRawDraft,
      submittedWhileStreaming: input.isStreaming,
    })
  } else if (result.status === 'error' || result.status === 'stopped') {
    handleRestorableComposerResult({
      ...input,
      result,
      submittedAttachments,
      submittedDraftChatId,
      submittedRawDraft,
    })
  }
}
