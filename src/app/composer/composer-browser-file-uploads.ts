import { canUploadComposerFilesQuery, uploadComposerFilesQuery } from '../query/desktop-query'

function toArray<T>(value: Iterable<T> | ArrayLike<T> | null | undefined): T[] {
  if (!value) {
    return []
  }

  return Array.from(value)
}

function isBrowserFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

export function getUploadableFilesFromTransfer(transfer: DataTransfer | null) {
  if (!transfer) {
    return []
  }

  const files = toArray(transfer.files).filter(isBrowserFile)
  const itemFiles = toArray(transfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(isBrowserFile)

  return [...new Set([...files, ...itemFiles])]
}

export function canUploadComposerFiles() {
  return canUploadComposerFilesQuery()
}

export async function uploadComposerFilesAsAttachments(files: File[]) {
  if (files.length === 0 || !canUploadComposerFiles()) {
    return []
  }

  return uploadComposerFilesQuery(files)
}

export async function uploadTransferFilesAsAttachments(transfer: DataTransfer | null) {
  return uploadComposerFilesAsAttachments(getUploadableFilesFromTransfer(transfer))
}
