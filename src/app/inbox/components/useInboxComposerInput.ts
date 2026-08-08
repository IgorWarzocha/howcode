import { useComposerAttachmentPicker } from '../../composer/useComposerAttachmentPicker'
import { useComposerClipboardHandlers } from '../../composer/useComposerClipboardHandlers'
import { useComposerDictation } from '../../composer/useComposerDictation'
import type { InboxComposerProps } from './inbox-composer-types'
import type { InboxComposerOverlayState } from './useInboxComposerOverlayState'
import { useInboxComposerStateRefs } from './useInboxComposerStateRefs'

export function useInboxComposerInput(
  props: Pick<InboxComposerProps, 'appSettings' | 'onListAttachmentEntries' | 'reply' | 'thread'>,
  overlay: InboxComposerOverlayState,
) {
  const { attachmentsRef, draftValueRef, setAttachmentValue, setDraftValue } =
    useInboxComposerStateRefs({
      attachments: props.reply.attachments,
      draft: props.reply.draft,
      onChangeAttachments: props.reply.setAttachments,
      onChangeDraft: props.reply.setDraft,
    })

  const attachmentPicker = useComposerAttachmentPicker({
    openMenu: overlay.openMenu,
    pickerRootPath: props.thread.projectId,
    pickerSessionKey: props.thread.sessionPath,
    setAttachments: setAttachmentValue,
    setErrorMessage: props.reply.setErrorMessage,
    setOpenMenu: overlay.setOpenMenu,
    onListAttachmentEntries: props.onListAttachmentEntries,
  })

  const dictation = useComposerDictation({
    activeView: 'inbox',
    dictationModelId: props.appSettings.dictationModelId,
    dictationMaxDurationSeconds: props.appSettings.dictationMaxDurationSeconds,
    draftThreadId: props.thread.threadId,
    projectId: props.thread.projectId,
    sessionPath: props.thread.sessionPath,
    setDraftValue,
    setErrorMessage: props.reply.setErrorMessage,
  })

  const { handlePaste } = useComposerClipboardHandlers({
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage: props.reply.setErrorMessage,
  })

  return {
    ...attachmentPicker,
    ...dictation,
    attachmentsRef,
    draftValueRef,
    handlePaste,
    setAttachmentValue,
    setDraftValue,
  }
}

export type InboxComposerInput = ReturnType<typeof useInboxComposerInput>
