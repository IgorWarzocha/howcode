import { mergeComposerAttachments } from '@howcode/shared/composer-attachments'
import { type Dispatch, type SetStateAction, useCallback } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import { uploadTransferFilesAsAttachments } from './composer-browser-file-uploads'
import {
  getComposerAttachmentsFromClipboardData,
  getPreferredClipboardTextFromClipboardData,
  hasFilePayloadInClipboardData,
} from './composer-paste-attachments'

type UseComposerClipboardHandlersInput = {
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: (value: SetStateAction<string>) => void
  setErrorMessage: Dispatch<SetStateAction<string | null>>
}

export function useComposerClipboardHandlers({
  setAttachments,
  setDraftValue,
  setErrorMessage,
}: UseComposerClipboardHandlersInput) {
  const attachTransfer = useCallback(
    async (transfer: DataTransfer | null) => {
      const links = getComposerAttachmentsFromClipboardData(transfer)
      const uploaded = await uploadTransferFilesAsAttachments(transfer)
      const attachments = mergeComposerAttachments(uploaded, links)
      if (attachments.length === 0) return false
      setAttachments((current) => mergeComposerAttachments(current, attachments))
      setErrorMessage(null)
      return true
    },
    [setAttachments, setErrorMessage],
  )

  const handlePaste = useCallback(
    async ({
      clipboardData,
      textarea,
    }: {
      clipboardData: DataTransfer | null
      textarea: HTMLTextAreaElement
    }) => {
      const text = getPreferredClipboardTextFromClipboardData(clipboardData)
      const hasFiles = hasFilePayloadInClipboardData(clipboardData)
      try {
        if (await attachTransfer(clipboardData)) return
        if (hasFiles) {
          setErrorMessage('Could not attach the pasted file. Use Device to upload it.')
          return
        }
        if (!text) return
        textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end')
        setDraftValue(textarea.value)
        setErrorMessage(null)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Upload failed.'
        setErrorMessage(`Could not attach pasted file. ${detail}`)
      }
    },
    [attachTransfer, setDraftValue, setErrorMessage],
  )

  const handleDrop = useCallback(
    async (transfer: DataTransfer | null) => {
      const hasFiles = hasFilePayloadInClipboardData(transfer)
      try {
        const attached = await attachTransfer(transfer)
        if (!attached && hasFiles) {
          setErrorMessage('Could not attach the dropped file. Use Device to upload it.')
          return true
        }
        return attached
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Upload failed.'
        setErrorMessage(`Could not attach dropped file. ${detail}`)
        return true
      }
    },
    [attachTransfer, setErrorMessage],
  )

  return { handleDrop, handlePaste }
}
