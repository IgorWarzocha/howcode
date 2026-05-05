import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposerAttachment } from '../../../../desktop/types'
import { mergeDraftWithRestoredQueuedPrompt } from '../composer-queue.helpers'
import { composerDraftStore, getComposerDraftThreadId } from '../composerDraftStore'

export function useComposerDraftState({
  composerMode,
  projectId,
  sessionPath,
  openMenu,
  setOpenMenu,
  setErrorMessage,
  restoredQueuedPrompt,
  onRestoredQueuedPromptApplied,
}: {
  composerMode: 'chat' | 'code'
  projectId: string
  sessionPath: string | null
  openMenu: 'model' | 'picker' | null
  setOpenMenu: (value: SetStateAction<'model' | 'picker' | null>) => void
  setErrorMessage: (value: SetStateAction<string | null>) => void
  restoredQueuedPrompt: string | null
  onRestoredQueuedPromptApplied: () => void
}) {
  const draftThreadId = useMemo(
    () => getComposerDraftThreadId({ composerMode, projectId, sessionPath }),
    [composerMode, projectId, sessionPath],
  )
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const composerScopeKey = useMemo(
    () => `${composerMode}::${projectId}::${sessionPath ?? ''}::${draftThreadId ?? ''}`,
    [composerMode, draftThreadId, projectId, sessionPath],
  )
  const activeComposerScopeKeyRef = useRef(composerScopeKey)
  const activeDraftThreadIdRef = useRef<string | null>(draftThreadId)
  const skipNextDraftPersistenceRef = useRef<string | null>(null)
  const attachmentsRef = useRef<ComposerAttachment[]>([])
  const draftValueRef = useRef('')

  activeDraftThreadIdRef.current = draftThreadId
  activeComposerScopeKeyRef.current = composerScopeKey
  attachmentsRef.current = attachments

  const setDraftValue = useCallback((value: SetStateAction<string>) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: string) => string)(draftValueRef.current)
        : value
    draftValueRef.current = nextValue
    setDraft(nextValue)
  }, [])

  const setAttachmentValue = useCallback((value: SetStateAction<ComposerAttachment[]>) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: ComposerAttachment[]) => ComposerAttachment[])(attachmentsRef.current)
        : value
    attachmentsRef.current = nextValue
    setAttachments(nextValue)
  }, [])

  useEffect(() => {
    skipNextDraftPersistenceRef.current = draftThreadId

    const persistedDraft = draftThreadId ? composerDraftStore.getDraft(draftThreadId) : null
    setDraftValue(persistedDraft?.prompt ?? '')
    setAttachmentValue(persistedDraft?.attachments ?? [])
    setOpenMenu(persistedDraft?.pickerOpen ? 'picker' : null)
    setErrorMessage(null)
  }, [draftThreadId, setAttachmentValue, setDraftValue, setErrorMessage, setOpenMenu])

  useEffect(() => {
    if (!draftThreadId) {
      return
    }

    if (skipNextDraftPersistenceRef.current === draftThreadId) {
      skipNextDraftPersistenceRef.current = null
      return
    }

    composerDraftStore.setDraft(draftThreadId, {
      prompt: draft,
      attachments,
      pickerOpen: openMenu === 'picker',
    })
  }, [attachments, draft, draftThreadId, openMenu])

  useEffect(() => {
    if (!restoredQueuedPrompt) {
      return
    }

    setDraftValue((currentDraft) =>
      mergeDraftWithRestoredQueuedPrompt(currentDraft, restoredQueuedPrompt),
    )
    setErrorMessage(null)
    onRestoredQueuedPromptApplied()
  }, [onRestoredQueuedPromptApplied, restoredQueuedPrompt, setDraftValue, setErrorMessage])

  return {
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
  }
}
