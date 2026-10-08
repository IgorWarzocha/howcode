import { mergeComposerAttachments } from '@howcode/shared/composer-attachments'
import { isSafeExternalUrl } from '@howcode/shared/external-url'
import type { ComposerAttachment, ComposerFilePickerState } from '../desktop/types'
import { openExternalQuery } from '../query/desktop-query'
import { uploadTransferFilesAsAttachments } from './composer-browser-file-uploads'
import { getComposerAttachmentsFromClipboardData } from './composer-paste-attachments'

const pathSeparatorPattern = /[\\/]/
const trailingPathSeparatorsPattern = /[\\/]+$/
const externalUrlProtocolPattern = /^https?:\/\//i

export type ComposerFilePickerRootOption = {
  path: string
  label: string
  iconOnly: boolean
}

export function getFolderLabel(folderPath: string) {
  const segments = folderPath.split(pathSeparatorPattern).filter(Boolean)
  return segments[segments.length - 1] ?? folderPath
}

export function buildFilePickerRootOptions({
  favoriteFolders,
  picker,
  projectRootPath,
}: {
  favoriteFolders: string[]
  picker: ComposerFilePickerState | null
  projectRootPath: string
}) {
  return [
    ...(picker?.homePath ? [{ path: picker.homePath, label: 'Home', iconOnly: true }] : []),
    { path: projectRootPath, label: 'Workspace', iconOnly: false },
    ...favoriteFolders.map((folderPath) => ({
      path: folderPath,
      label: getFolderLabel(folderPath),
      iconOnly: false,
    })),
  ].filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.path === option.path) === index,
  )
}

export function filterFilePickerEntries(
  entries: ComposerFilePickerState['entries'],
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase()

  if (!query) {
    return entries
  }

  return entries.filter((entry) => entry.name.toLowerCase().includes(query))
}

export function getOpenAttachmentLabel(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return `Open ${attachment.name} in browser`
  }

  return `Open ${attachment.name}`
}

export function getAttachmentDisplayLabel(attachment: ComposerAttachment) {
  if (!isSafeExternalUrl(attachment.path)) {
    if (attachment.kind === 'directory') {
      const normalizedPath = attachment.path.replace(trailingPathSeparatorsPattern, '')
      const parts = normalizedPath.split(pathSeparatorPattern).filter(Boolean)

      if (parts.length >= 2) {
        return `${attachment.path.startsWith('/') ? '/' : ''}${parts.slice(-2).join('/')}`
      }
    }

    return attachment.name
  }

  return attachment.path.replace(externalUrlProtocolPattern, '')
}

export async function openComposerAttachment(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    await openExternalQuery(attachment.path)
  }
}

export async function getDroppedComposerAttachments(dataTransfer: DataTransfer) {
  const rawAttachments = getComposerAttachmentsFromClipboardData(dataTransfer)
  const uploadedAttachments = await uploadTransferFilesAsAttachments(dataTransfer)
  return mergeComposerAttachments(rawAttachments, uploadedAttachments)
}
