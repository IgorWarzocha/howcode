import {
  extractComposerAttachmentsFromPaste,
  mergeComposerAttachments,
} from '@howcode/shared/composer-attachments'
import { isSafeExternalUrl } from '@howcode/shared/external-url'
import type { ComposerAttachment } from '../desktop/types'

export type ComposerClipboardDataLike = {
  getData: (type: string) => string
  types?: Iterable<string> | ArrayLike<string> | null
  files?: ArrayLike<unknown> | null
  items?: Iterable<{ kind?: string | null }> | ArrayLike<{ kind?: string | null }> | null
}

// Browser transfers cannot identify client filesystem paths. Only uploaded File
// payloads and safe external links can become attachments.
export function getComposerAttachmentsFromClipboardData(
  clipboardData: ComposerClipboardDataLike | null,
) {
  if (!clipboardData) return []
  let attachments: ComposerAttachment[] = []
  for (const type of ['text/uri-list', 'text/plain', 'text']) {
    attachments = mergeComposerAttachments(
      attachments,
      extractComposerAttachmentsFromPaste(clipboardData.getData(type), {
        sourceType: type,
        allowPartial: type === 'text/uri-list',
      }).filter((attachment) => isSafeExternalUrl(attachment.path)),
    )
  }
  return attachments
}

export function hasFilePayloadInClipboardData(clipboardData: ComposerClipboardDataLike | null) {
  if (!clipboardData) return false
  return (
    (clipboardData.files?.length ?? 0) > 0 ||
    Array.from(clipboardData.items ?? []).some((item) => item.kind === 'file') ||
    Array.from(clipboardData.types ?? []).includes('Files')
  )
}

export function hasAttachmentHintInClipboardData(clipboardData: ComposerClipboardDataLike | null) {
  return (
    hasFilePayloadInClipboardData(clipboardData) ||
    getComposerAttachmentsFromClipboardData(clipboardData).length > 0
  )
}

export function getPreferredClipboardTextFromClipboardData(
  clipboardData: ComposerClipboardDataLike | null,
) {
  if (!clipboardData) return ''
  return (
    clipboardData.getData('text/plain') ||
    clipboardData.getData('text') ||
    clipboardData.getData('text/uri-list')
  )
}
