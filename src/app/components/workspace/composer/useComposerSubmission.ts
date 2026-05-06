import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from 'react'
import { isCompactSlashCommand } from '../../../../../shared/composer-slash-commands'
import { getDesktopActionErrorMessage } from '../../../desktop/action-results'
import { getErrorMessage } from '../../../desktop/error-messages'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../../../desktop/types'
import {
  areSameAttachments,
  getComposerPostSendCleanup,
  isSameSubmittedDraft,
} from './composer-submission-cleanup'
import { composerDraftStore } from './composerDraftStore'
import { withComposerSendLock } from './composerSendLock'
import { submitComposerDraft } from './submitComposerDraft'

type SubmitResult = Awaited<ReturnType<typeof submitComposerDraft>>

function clearPendingSubmitted(input: {
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
    if (cleanup.skipNextDraftPersistence)
      input.skipNextDraftPersistenceRef.current = input.submittedDraftThreadId
    composerDraftStore.clearThreadDraft(input.submittedDraftThreadId)
  }
  if (cleanup.clearStoredPrompt && input.submittedDraftThreadId)
    composerDraftStore.setPrompt(input.submittedDraftThreadId, '')
  if (cleanup.nextAttachments !== null) input.setAttachments(cleanup.nextAttachments)
  if (
    input.submittedWhileStreaming &&
    input.activeDraftThreadIdRef.current === input.submittedDraftThreadId
  ) {
    clearPendingSubmitted(input)
    if (isSameSubmittedDraft(input.draftValueRef.current, input.submittedRawDraft))
      input.setDraftValue('')
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

async function runExtensionCommandSubmission(input: {
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
    if (input.activeComposerScopeKeyRef.current === input.composerScopeKey)
      input.setErrorMessage(getErrorMessage(error, 'Could not send prompt.'))
  } finally {
    if (input.extensionCommandRunIdRef.current === input.runId)
      input.setExtensionCommandRunning(false)
  }
}

async function runComposerSendSubmission(input: {
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
  if (result.status === 'sent')
    handleSentComposerResult({
      ...input,
      preserveAttachments: isCompactSlashCommand(submittedDraft),
      submittedAttachments,
      submittedDraftThreadId,
      submittedRawDraft,
      submittedWhileStreaming: input.isStreaming,
    })
  else if (result.status === 'error' || result.status === 'stopped')
    handleRestorableComposerResult({
      ...input,
      result,
      submittedAttachments,
      submittedDraftThreadId,
      submittedRawDraft,
    })
}

type UseComposerSubmissionProps = {
  composerScopeKey: string
  draftThreadId: string | null
  isSending: boolean
  isStreaming: boolean
  isCompacting: boolean
  extensionCommandRunning: boolean
  onAction: DesktopActionInvoker
  projectId: string
  chatGroupId?: string | null
  sessionPath: string | null
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  setExtensionCommandRunning: Dispatch<SetStateAction<boolean>>
  setIsSending: Dispatch<SetStateAction<boolean>>
  setPendingSubmittedDraft: Dispatch<SetStateAction<string | null>>
  pendingSubmittedReplyActivityKeyRef: MutableRefObject<string | null>
  replyActivityKey: string
  setOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  stopDictationAndFlush: () => Promise<void>
  streamingBehaviorPreference: ComposerStreamingBehavior
  activeComposerScopeKeyRef: MutableRefObject<string>
  activeDraftThreadIdRef: MutableRefObject<string | null>
  attachmentsRef: MutableRefObject<ComposerAttachment[]>
  draftValueRef: MutableRefObject<string>
  sendLockRef: MutableRefObject<boolean>
  skipNextDraftPersistenceRef: MutableRefObject<string | null>
}

export function useComposerSubmission({
  composerScopeKey,
  draftThreadId,
  isSending,
  isStreaming,
  isCompacting,
  extensionCommandRunning,
  onAction,
  projectId,
  chatGroupId = null,
  sessionPath,
  setAttachments,
  setDraftValue,
  setErrorMessage,
  setExtensionCommandRunning,
  setIsSending,
  setPendingSubmittedDraft,
  pendingSubmittedReplyActivityKeyRef,
  replyActivityKey,
  setOpenMenu,
  stopDictationAndFlush,
  streamingBehaviorPreference,
  activeComposerScopeKeyRef,
  activeDraftThreadIdRef,
  attachmentsRef,
  draftValueRef,
  sendLockRef,
  skipNextDraftPersistenceRef,
}: UseComposerSubmissionProps) {
  const extensionCommandRunIdRef = useRef(0)

  const sendExtensionCommand = useCallback(() => {
    if (isCompacting || extensionCommandRunning || sendLockRef.current) {
      return
    }

    const runId = extensionCommandRunIdRef.current + 1
    extensionCommandRunIdRef.current = runId
    setErrorMessage(null)
    setOpenMenu(null)
    setExtensionCommandRunning(true)

    void withComposerSendLock(sendLockRef, () =>
      runExtensionCommandSubmission({
        activeComposerScopeKeyRef,
        chatGroupId,
        composerScopeKey,
        draftThreadId,
        draftValueRef,
        extensionCommandRunIdRef,
        onAction,
        projectId,
        runId,
        sessionPath,
        setDraftValue,
        setErrorMessage,
        setExtensionCommandRunning,
        stopDictationAndFlush,
        streamingBehaviorPreference,
      }),
    )
  }, [
    activeComposerScopeKeyRef,
    chatGroupId,
    composerScopeKey,
    draftThreadId,
    draftValueRef,
    extensionCommandRunning,
    isCompacting,
    onAction,
    projectId,
    sessionPath,
    sendLockRef,
    setDraftValue,
    setErrorMessage,
    setExtensionCommandRunning,
    setOpenMenu,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ])

  const send = useCallback(async () => {
    if (isSending || isCompacting || sendLockRef.current) {
      return
    }

    await withComposerSendLock(sendLockRef, async () => {
      setIsSending(true)
      try {
        await runComposerSendSubmission({
          activeComposerScopeKeyRef,
          activeDraftThreadIdRef,
          attachmentsRef,
          chatGroupId,
          composerScopeKey,
          draftThreadId,
          draftValueRef,
          isStreaming,
          onAction,
          pendingSubmittedReplyActivityKeyRef,
          projectId,
          replyActivityKey,
          sessionPath,
          setAttachments,
          setDraftValue,
          setErrorMessage,
          setOpenMenu,
          setPendingSubmittedDraft,
          skipNextDraftPersistenceRef,
          stopDictationAndFlush,
          streamingBehaviorPreference,
        })
      } catch (error) {
        if (activeDraftThreadIdRef.current === draftThreadId)
          clearPendingSubmitted({ pendingSubmittedReplyActivityKeyRef, setPendingSubmittedDraft })
        setErrorMessage(getErrorMessage(error, 'Could not send prompt.'))
      } finally {
        setIsSending(false)
      }
    })
  }, [
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachmentsRef,
    chatGroupId,
    composerScopeKey,
    draftThreadId,
    draftValueRef,
    isCompacting,
    isSending,
    isStreaming,
    onAction,
    pendingSubmittedReplyActivityKeyRef,
    projectId,
    replyActivityKey,
    sendLockRef,
    sessionPath,
    setAttachments,
    setDraftValue,
    setErrorMessage,
    setIsSending,
    setPendingSubmittedDraft,
    setOpenMenu,
    skipNextDraftPersistenceRef,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ])

  const stop = useCallback(async () => {
    if (!(isStreaming || extensionCommandRunning) || isSending || !sessionPath) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const result = await onAction('composer.stop', {
        projectId,
        sessionPath,
      })

      const actionErrorMessage = getDesktopActionErrorMessage(result, 'Could not stop Pi.')
      if (actionErrorMessage) {
        setErrorMessage(actionErrorMessage)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not stop Pi.'))
    } finally {
      setIsSending(false)
    }
  }, [
    extensionCommandRunning,
    isSending,
    isStreaming,
    onAction,
    projectId,
    sessionPath,
    setErrorMessage,
    setIsSending,
  ])

  const compact = useCallback(async () => {
    if (isSending || isStreaming || isCompacting || !sessionPath || sendLockRef.current) {
      return
    }

    await withComposerSendLock(sendLockRef, async () => {
      setIsSending(true)
      setErrorMessage(null)

      try {
        await stopDictationAndFlush()

        const result = await submitComposerDraft({
          draft: '/compact',
          attachments: [],
          isSending: false,
          projectId,
          chatGroupId,
          sessionPath,
          streamingBehaviorPreference,
          onAction,
        })

        if (result.status === 'error') {
          setErrorMessage(result.errorMessage)
        }
      } finally {
        setIsSending(false)
      }
    })
  }, [
    isCompacting,
    isSending,
    isStreaming,
    chatGroupId,
    onAction,
    projectId,
    sendLockRef,
    sessionPath,
    setErrorMessage,
    setIsSending,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ])

  return {
    compact,
    send,
    sendExtensionCommand,
    stop,
  }
}
