import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import { getErrorMessage } from '../desktop/error-messages'
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../desktop/types'
import { clearPendingSubmitted, runComposerSendSubmission } from './composer-submission-runner'
import { withComposerSendLock } from './composerSendLock'
import { submitComposerDraft } from './submitComposerDraft'

type UseComposerSubmissionProps = {
  composerScopeKey: string
  draftThreadId: string | null
  isSending: boolean
  isStreaming: boolean
  isCompacting: boolean
  onAction: DesktopActionInvoker
  projectId: string
  chatGroupId?: string | null
  conversationId: string | null
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
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
  onAction,
  projectId,
  chatGroupId = null,
  conversationId,
  setAttachments,
  setDraftValue,
  setErrorMessage,
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
          conversationId,
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
    conversationId,
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
    if (!isStreaming || isSending || !conversationId) return

    setIsSending(true)
    setErrorMessage(null)

    try {
      const result = await onAction('composer.stop', {
        projectId,
        conversationId,
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
  }, [isSending, isStreaming, onAction, projectId, conversationId, setErrorMessage, setIsSending])

  const compact = useCallback(async () => {
    if (isSending || isStreaming || isCompacting || !conversationId || sendLockRef.current) {
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
          conversationId,
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
    conversationId,
    setErrorMessage,
    setIsSending,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ])

  return {
    compact,
    send,
    stop,
  }
}
