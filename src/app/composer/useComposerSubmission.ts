import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from 'react'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import { getErrorMessage } from '../desktop/error-messages'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../desktop/types'
import {
  clearPendingSubmitted,
  runComposerSendSubmission,
  runExtensionCommandSubmission,
} from './composer-submission-runner'
import { withComposerSendLock } from './composerSendLock'
import { submitComposerDraft } from './submitComposerDraft'

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
