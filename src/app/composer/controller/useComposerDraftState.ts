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
import { composerDraftStore, getComposerDraftChatId } from '../composerDraftStore'

export function useComposerDraftState({
  composerProfile,
  directoryId,
  conversationId,
  openMenu,
  setOpenMenu,
  setErrorMessage,
}: {
  composerProfile: 'general' | 'coding'
  directoryId: string
  conversationId: string | null
  openMenu: 'model' | 'picker' | null
  setOpenMenu: (value: SetStateAction<'model' | 'picker' | null>) => void
  setErrorMessage: (value: SetStateAction<string | null>) => void
}) {
  const draftChatId = useMemo(
    () => getComposerDraftChatId({ composerProfile, directoryId, conversationId }),
    [composerProfile, directoryId, conversationId],
  )
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const composerScopeKey = useMemo(
    () => `${composerProfile}::${directoryId}::${conversationId ?? ''}::${draftChatId ?? ''}`,
    [composerProfile, draftChatId, directoryId, conversationId],
  )
  const activeComposerScopeKeyRef = useLatestRef(composerScopeKey)
  const activeDraftChatIdRef = useLatestRef(draftChatId)
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
    skipNextDraftPersistenceRef.current = draftChatId

    const persistedDraft = draftChatId ? composerDraftStore.getDraft(draftChatId) : null
    setDraftValue(persistedDraft?.prompt ?? '')
    setAttachmentValue(persistedDraft?.attachments ?? [])
    resetParentComposerState(persistedDraft?.pickerOpen === true)
  }, [draftChatId, setAttachmentValue, setDraftValue])

  useEffect(() => {
    if (!draftChatId) {
      return
    }

    if (skipNextDraftPersistenceRef.current === draftChatId) {
      skipNextDraftPersistenceRef.current = null
      return
    }

    composerDraftStore.setDraft(draftChatId, {
      prompt: draft,
      attachments,
      pickerOpen: openMenu === 'picker',
    })
  }, [attachments, draft, draftChatId, openMenu])

  return {
    activeComposerScopeKeyRef,
    activeDraftChatIdRef,
    attachments,
    attachmentsRef,
    composerScopeKey,
    draft,
    draftChatId,
    draftValueRef,
    setAttachmentValue,
    setDraftValue,
    skipNextDraftPersistenceRef,
  }
}
