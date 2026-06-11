import { randomUUID } from 'node:crypto'
import { mkdir, open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getAttachmentKind } from '../../shared/composer-attachments'
import type { ComposerAttachment } from '../../shared/desktop-contracts'

const leadingDotsPattern = /^\.+/
const unsafeFileNameCharactersPattern = /[\\/:*?"<>|]/g

export const browserUploadAttachmentLimits = {
  maxFiles: 20,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
}

export type BrowserUploadAttachmentFile = {
  name?: unknown
  type?: unknown
  dataBase64?: unknown
}

export type BrowserUploadAttachmentsRequest = {
  files?: unknown
}

const extensionByMimeType = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
  ['image/svg+xml', '.svg'],
  ['text/plain', '.txt'],
  ['application/json', '.json'],
  ['text/markdown', '.md'],
])

function removeControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint >= 32 && codePoint !== 127
    })
    .join('')
}

function getSafeUploadFileName(input: BrowserUploadAttachmentFile, index: number) {
  const rawName = typeof input.name === 'string' ? input.name : ''
  const baseName = path.basename(rawName || `upload-${index + 1}`)
  let safeName = removeControlCharacters(baseName)
    .replace(unsafeFileNameCharactersPattern, '-')
    .replace(leadingDotsPattern, '')
    .trim()

  if (!safeName) {
    safeName = `upload-${index + 1}`
  }

  if (!path.extname(safeName) && typeof input.type === 'string') {
    safeName += extensionByMimeType.get(input.type.toLowerCase()) ?? ''
  }

  return safeName || `upload-${index + 1}`
}

function decodeUploadDataBase64(input: BrowserUploadAttachmentFile) {
  if (typeof input.dataBase64 !== 'string' || input.dataBase64.length === 0) {
    throw new Error('Uploaded file is missing data.')
  }

  const buffer = Buffer.from(input.dataBase64, 'base64')
  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty.')
  }

  if (buffer.length > browserUploadAttachmentLimits.maxFileBytes) {
    throw new Error('Uploaded file is too large.')
  }

  return buffer
}

async function writeUniqueUploadFile(directoryPath: string, fileName: string, buffer: Buffer) {
  const parsed = path.parse(fileName)

  for (let index = 0; index < 100; index += 1) {
    const candidateName = index === 0 ? fileName : `${parsed.name}-${index + 1}${parsed.ext}`
    const candidatePath = path.join(directoryPath, candidateName)

    try {
      const file = await open(candidatePath, 'wx', 0o600)
      try {
        await file.writeFile(buffer)
      } finally {
        await file.close()
      }
      return candidatePath
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        continue
      }

      throw error
    }
  }

  throw new Error('Could not find an unused upload file name.')
}

function getUploadFiles(request: BrowserUploadAttachmentsRequest) {
  if (!Array.isArray(request.files)) {
    return []
  }

  if (request.files.length > browserUploadAttachmentLimits.maxFiles) {
    throw new Error('Too many uploaded files.')
  }

  return request.files.filter(
    (file): file is BrowserUploadAttachmentFile => typeof file === 'object' && file !== null,
  )
}

export async function writeBrowserUploadComposerAttachments(
  request: BrowserUploadAttachmentsRequest,
  options: { rootDirectory?: string | undefined } = {},
): Promise<ComposerAttachment[]> {
  const files = getUploadFiles(request)
  if (files.length === 0) {
    return []
  }

  const uploadDirectory = path.join(
    options.rootDirectory ?? path.join(tmpdir(), 'howcode-browser-uploads'),
    randomUUID(),
  )
  await mkdir(uploadDirectory, { recursive: true, mode: 0o700 })

  let totalBytes = 0
  const attachments: ComposerAttachment[] = []
  for (const [index, file] of files.entries()) {
    const buffer = decodeUploadDataBase64(file)
    totalBytes += buffer.length
    if (totalBytes > browserUploadAttachmentLimits.maxTotalBytes) {
      throw new Error('Uploaded files are too large.')
    }

    const name = getSafeUploadFileName(file, index)
    const filePath = await writeUniqueUploadFile(uploadDirectory, name, buffer)
    attachments.push({
      path: filePath,
      name,
      kind:
        typeof file.type === 'string' && file.type.startsWith('image/')
          ? 'image'
          : getAttachmentKind(filePath),
    })
  }

  return attachments
}
