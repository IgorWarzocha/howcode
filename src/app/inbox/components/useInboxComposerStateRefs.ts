import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type { ComposerAttachment } from '../../desktop/types'

export function useInboxComposerStateRefs({
  attachments,
  draft,
  onChangeAttachments,
  onChangeDraft,
}: {
  attachments: ComposerAttachment[]
  draft: string
  onChangeAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  onChangeDraft: Dispatch<SetStateAction<string>>
}) {
  const draftValueRef = useRef(draft)
  const attachmentsRef = useRef(attachments)

  useEffect(() => {
    draftValueRef.current = draft
  }, [draft])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  const setDraftValue: Dispatch<SetStateAction<string>> = (value) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: string) => string)(draftValueRef.current)
        : value
    draftValueRef.current = nextValue
    onChangeDraft(nextValue)
  }

  const setAttachmentValue: Dispatch<SetStateAction<ComposerAttachment[]>> = (value) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: ComposerAttachment[]) => ComposerAttachment[])(attachmentsRef.current)
        : value
    attachmentsRef.current = nextValue
    onChangeAttachments(nextValue)
  }

  return { attachmentsRef, draftValueRef, setAttachmentValue, setDraftValue }
}
