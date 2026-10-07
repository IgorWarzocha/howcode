import { useComposerDictation } from '@howcode/components/dictation/ui'
import { useEffect, useRef, useState } from 'react'
import type {
  ComposerFilePickerState,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { View } from '../../types'
import { useComposerAttachmentPicker } from '../useComposerAttachmentPicker'
import { useComposerClipboardHandlers } from '../useComposerClipboardHandlers'
import { useComposerSubmission } from '../useComposerSubmission'
import { useComposerActionRunner } from './useComposerActionRunner'
import { useComposerDraftState } from './useComposerDraftState'

type UseComposerControllerProps = {
  activeView: View
  projectId: string
  chatGroupId?: string | null | undefined
  conversationId: string | null
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  isStreaming: boolean
  replyActivityKey: string
  isCompacting: boolean
  streamingBehaviorPreference: ComposerStreamingBehavior
  onAction: DesktopActionInvoker
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
}

export function useComposerController({
  activeView,
  projectId,
  chatGroupId = null,
  conversationId,
  dictationModelId,
  dictationMaxDurationSeconds,
  isStreaming,
  replyActivityKey,
  isCompacting,
  streamingBehaviorPreference,
  onAction,
  onListAttachmentEntries,
}: UseComposerControllerProps) {
  const [openMenu, setOpenMenu] = useState<'model' | 'picker' | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [pendingSubmittedDraft, setPendingSubmittedDraft] = useState<string | null>(null)
  const pendingSubmittedReplyActivityKeyRef = useRef<string | null>(null)
  const pendingSubmittedDraftScopeKeyRef = useRef<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const pickerPanelRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const sendLockRef = useRef(false)
  const {
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachments,
    attachmentsRef,
    composerScopeKey,
    draft,
    draftThreadId,
    draftValueRef,
    setAttachmentValue,
    setDraftValue,
    skipNextDraftPersistenceRef,
  } = useComposerDraftState({
    composerMode,
    projectId,
    conversationId,
    openMenu,
    setOpenMenu,
    setErrorMessage,
  })
  useDismissibleLayer({
    open: openMenu === 'model',
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  })

  useEffect(() => {
    if (openMenu !== 'picker') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (!target) {
        return
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return
      }

      setOpenMenu((current) => (current === 'picker' ? null : current))
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [openMenu])

  useEffect(() => {
    if (
      !pendingSubmittedDraft ||
      pendingSubmittedReplyActivityKeyRef.current === null ||
      pendingSubmittedReplyActivityKeyRef.current === replyActivityKey
    ) {
      return
    }

    if (draftValueRef.current === pendingSubmittedDraft) {
      setDraftValue('')
    }
    pendingSubmittedReplyActivityKeyRef.current = null
    setPendingSubmittedDraft(null)
  }, [draftValueRef, pendingSubmittedDraft, replyActivityKey, setDraftValue])

  useEffect(() => {
    if (!pendingSubmittedDraft || isSending || isStreaming) return
    const submittedReplyActivityKey = pendingSubmittedReplyActivityKeyRef.current
    const timeout = window.setTimeout(() => {
      if (pendingSubmittedReplyActivityKeyRef.current !== submittedReplyActivityKey) return
      pendingSubmittedReplyActivityKeyRef.current = null
      setPendingSubmittedDraft(null)
    }, 60_000)
    return () => window.clearTimeout(timeout)
  }, [isSending, isStreaming, pendingSubmittedDraft])

  useEffect(() => {
    if (pendingSubmittedDraftScopeKeyRef.current === composerScopeKey) return
    pendingSubmittedDraftScopeKeyRef.current = composerScopeKey
    if (pendingSubmittedDraft && isStreaming && replyActivityKey.length === 0) return
    pendingSubmittedReplyActivityKeyRef.current = null
    setPendingSubmittedDraft(null)
  }, [composerScopeKey, isStreaming, pendingSubmittedDraft, replyActivityKey])

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  } = useComposerDictation({
    activeView,
    dictationModelId,
    dictationMaxDurationSeconds,
    draftThreadId,
    projectId,
    conversationId,
    setDraftValue,
    setErrorMessage,
  })

  const {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  } = useComposerAttachmentPicker({
    openMenu,
    pickerRootPath: projectId,
    pickerSessionKey: draftThreadId,
    setAttachments: setAttachmentValue,
    setErrorMessage,
    setOpenMenu,
    onListAttachmentEntries,
  })

  const { invokeComposerAction, runComposerAction } = useComposerActionRunner({
    onAction,
    setErrorMessage,
    setOpenMenu,
  })

  const { compact, send, stop } = useComposerSubmission({
    composerScopeKey,
    draftThreadId,
    isSending,
    isStreaming,
    isCompacting,
    onAction,
    projectId,
    chatGroupId,
    conversationId,
    setAttachments: setAttachmentValue,
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
  })

  const { handleDrop, handlePaste } = useComposerClipboardHandlers({
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage,
  })

  return {
    attachments,
    handleDrop,
    handlePaste,
    cancelDictation,
    clearAttachments,
    clearError: () => setErrorMessage(null),
    draft: pendingSubmittedDraft ?? draft,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    errorMessage,
    isSending,
    inputLocked:
      isSending ||
      pendingSubmittedDraft !== null ||
      isCompacting ||
      (isStreaming && !replyActivityKey),
    pickerButtonRef,
    pickerLoading,
    pickerOpen: openMenu === 'picker',
    pickerPanelRef,
    pickerState,
    modelButtonRef,
    modelMenuOpen: openMenu === 'model',
    modelMenuRef,
    isStreaming,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    removeAttachment,
    invokeComposerAction,
    runComposerAction,
    compact,
    send,
    setDraft: setDraftValue,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPickerAttachments,
    togglePendingPickerAttachment,
  }
}
