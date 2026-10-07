import {
  type SetStateAction,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ComposerAttachment } from '../../desktop/types'
import { useLatestRef } from '../../hooks/useLatestRef'
import { composerDraftStore, getComposerDraftThreadId } from '../composerDraftStore'

export function useComposerDraftState({
  composerMode,
  projectId,
  conversationId,
  openMenu,
  setOpenMenu,
  setErrorMessage,
}: {
  composerMode: 'chat' | 'code'
  projectId: string
  conversationId: string | null
  openMenu: 'model' | 'picker' | null
  setOpenMenu: (value: SetStateAction<'model' | 'picker' | null>) => void
  setErrorMessage: (value: SetStateAction<string | null>) => void
}) {
  const draftThreadId = useMemo(
    () => getComposerDraftThreadId({ composerMode, projectId, conversationId }),
    [composerMode, projectId, conversationId],
  )
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const composerScopeKey = useMemo(
    () => `${composerMode}::${projectId}::${conversationId ?? ''}::${draftThreadId ?? ''}`,
    [composerMode, draftThreadId, projectId, conversationId],
  )
  const activeComposerScopeKeyRef = useLatestRef(composerScopeKey)
  const activeDraftThreadIdRef = useLatestRef(draftThreadId)
  const skipNextDraftPersistenceRef = useRef<string | null>(null)
  const attachmentsRef = useRef<ComposerAttachment[]>([])
  const draftValueRef = useRef('')
  const resetParentComposerState = useEffectEvent((pickerOpen: boolean) => {
    setOpenMenu(pickerOpen ? 'picker' : null)
    setErrorMessage(null)
  })

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
    resetParentComposerState(persistedDraft?.pickerOpen === true)
  }, [draftThreadId, setAttachmentValue, setDraftValue])

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
