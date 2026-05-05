import type { ComposerAttachment } from '../../../desktop/types'

export function isSameSubmittedDraft(currentDraft: string, submittedRawDraft: string) {
  return currentDraft === submittedRawDraft
}

export function areSameAttachments(
  currentAttachments: ComposerAttachment[],
  submittedAttachments: ComposerAttachment[],
) {
  if (currentAttachments === submittedAttachments) {
    return true
  }

  if (currentAttachments.length !== submittedAttachments.length) {
    return false
  }

  return currentAttachments.every((attachment, index) => {
    const submittedAttachment = submittedAttachments[index]
    return (
      attachment.path === submittedAttachment?.path &&
      attachment.name === submittedAttachment.name &&
      attachment.kind === submittedAttachment.kind
    )
  })
}

function isSameAttachment(left: ComposerAttachment, right: ComposerAttachment) {
  return left.path === right.path && left.name === right.name && left.kind === right.kind
}

function removeSubmittedAttachments(
  currentAttachments: ComposerAttachment[],
  submittedAttachments: ComposerAttachment[],
) {
  const remainingSubmittedAttachments = [...submittedAttachments]

  return currentAttachments.filter((attachment) => {
    const submittedIndex = remainingSubmittedAttachments.findIndex((submittedAttachment) =>
      isSameAttachment(attachment, submittedAttachment),
    )

    if (submittedIndex === -1) {
      return true
    }

    remainingSubmittedAttachments.splice(submittedIndex, 1)
    return false
  })
}

export type ComposerPostSendCleanup = {
  clearStoredDraft: boolean
  clearStoredPrompt: boolean
  clearDraft: boolean
  nextAttachments: ComposerAttachment[] | null
  skipNextDraftPersistence: boolean
}

export function getComposerPostSendCleanup({
  activeDraftThreadId,
  submittedDraftThreadId,
  preserveAttachments,
  currentDraft,
  submittedRawDraft,
  currentAttachments,
  submittedAttachments,
}: {
  activeDraftThreadId: string | null
  submittedDraftThreadId: string | null
  preserveAttachments: boolean
  currentDraft: string
  submittedRawDraft: string
  currentAttachments: ComposerAttachment[]
  submittedAttachments: ComposerAttachment[]
}): ComposerPostSendCleanup {
  const isActiveSubmittedDraft = activeDraftThreadId === submittedDraftThreadId
  const draftUnchanged = currentDraft === submittedRawDraft
  const attachmentsUnchanged = areSameAttachments(currentAttachments, submittedAttachments)
  const nextAttachments =
    isActiveSubmittedDraft && !preserveAttachments
      ? removeSubmittedAttachments(currentAttachments, submittedAttachments)
      : null
  const shouldClearStoredDraft = Boolean(
    submittedDraftThreadId &&
      !preserveAttachments &&
      (!isActiveSubmittedDraft || (draftUnchanged && attachmentsUnchanged)),
  )
  const shouldClearStoredPrompt = Boolean(
    submittedDraftThreadId && preserveAttachments && (!isActiveSubmittedDraft || draftUnchanged),
  )
  const clearDraft = isActiveSubmittedDraft && draftUnchanged

  return {
    clearStoredDraft: shouldClearStoredDraft,
    clearStoredPrompt: shouldClearStoredPrompt,
    clearDraft,
    nextAttachments,
    skipNextDraftPersistence:
      shouldClearStoredDraft && isActiveSubmittedDraft && draftUnchanged && attachmentsUnchanged,
  }
}
