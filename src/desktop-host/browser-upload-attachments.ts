import { randomUUID } from 'node:crypto'
import {
  type FileHandle,
  mkdir,
  open,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getAttachmentKind } from '../../shared/composer-attachments'
import type { ComposerAttachment } from '../../shared/desktop-contracts'

const leadingDotsPattern = /^\.+/
const unsafeFileNameCharactersPattern = /[\\/:*?"<>|]/g
const multipartHeaderSeparator = Buffer.from('\r\n\r\n')
const crlf = Buffer.from('\r\n')
const finalBoundarySuffix = Buffer.from('--')
const multipartHeaderBytesLimit = 16 * 1024
const multipartBoundaryPattern = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i

export const browserUploadAttachmentLimits = {
  maxFiles: 20,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
}

export const browserUploadAttachmentCleanup = {
  maxAgeDays: 14,
  markerFileName: '.last-cleanup-date',
}

type BrowserUploadAttachmentFileMetadata = {
  name?: unknown
  type?: unknown
}

type MultipartUploadFile = {
  handle: FileHandle
  path: string
  name: string
  type: string
  bytes: number
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

function getSafeUploadFileName(input: BrowserUploadAttachmentFileMetadata, index: number) {
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

async function openUniqueUploadFile(directoryPath: string, fileName: string) {
  const parsed = path.parse(fileName)

  for (let index = 0; index < 100; index += 1) {
    const candidateName = index === 0 ? fileName : `${parsed.name}-${index + 1}${parsed.ext}`
    const candidatePath = path.join(directoryPath, candidateName)

    try {
      return {
        handle: await open(candidatePath, 'wx', 0o600),
        path: candidatePath,
      }
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

function getUploadRootDirectory(rootDirectory?: string | undefined) {
  return rootDirectory ?? path.join(tmpdir(), 'howcode-browser-uploads')
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

async function readCleanupMarker(markerPath: string) {
  try {
    return (await readFile(markerPath, 'utf8')).trim()
  } catch {
    return null
  }
}

function getMultipartBoundary(contentType: string | string[] | undefined) {
  const normalizedContentType = Array.isArray(contentType) ? contentType[0] : contentType
  const match = normalizedContentType?.match(multipartBoundaryPattern)
  const boundary = match?.[1] ?? match?.[2]?.trim()
  if (!boundary) {
    throw new Error('Upload request must use multipart/form-data.')
  }

  return boundary
}

function getHeaderParameter(header: string | undefined, parameterName: string) {
  if (!header) return null

  const pattern = new RegExp(`(?:^|;)\\s*${parameterName}=(?:"([^"]*)"|([^;]*))`, 'i')
  const match = header.match(pattern)
  return (match?.[1] ?? match?.[2] ?? '').replace(/\\"/g, '"') || null
}

function parseMultipartHeaders(rawHeaders: string) {
  const headers = new Map<string, string>()
  for (const line of rawHeaders.split('\r\n')) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    headers.set(
      line.slice(0, separatorIndex).trim().toLowerCase(),
      line.slice(separatorIndex + 1).trim(),
    )
  }

  return headers
}

function getChunkBuffer(chunk: Buffer | string) {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
}

function startsWithBuffer(buffer: Buffer, prefix: Buffer) {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix)
}

export async function cleanupBrowserUploadComposerAttachments(
  options: { rootDirectory?: string | undefined; now?: Date | undefined } = {},
) {
  const rootDirectory = getUploadRootDirectory(options.rootDirectory)
  const now = options.now ?? new Date()
  const todayKey = getDateKey(now)
  const markerPath = path.join(rootDirectory, browserUploadAttachmentCleanup.markerFileName)

  await mkdir(rootDirectory, { recursive: true, mode: 0o700 })

  if ((await readCleanupMarker(markerPath)) === todayKey) {
    return { removedEntries: 0, skipped: true }
  }

  const cutoffMs = now.getTime() - browserUploadAttachmentCleanup.maxAgeDays * 24 * 60 * 60 * 1000
  let removedEntries = 0

  const entries = await readdir(rootDirectory, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === browserUploadAttachmentCleanup.markerFileName) {
        return
      }

      const entryPath = path.join(rootDirectory, entry.name)
      const entryStats = await stat(entryPath).catch(() => null)
      if (!entryStats || entryStats.mtimeMs >= cutoffMs) {
        return
      }

      await rm(entryPath, { recursive: true, force: true })
      removedEntries += 1
    }),
  )

  await writeFile(markerPath, `${todayKey}\n`, { mode: 0o600 })
  return { removedEntries, skipped: false }
}

export function scheduleBrowserUploadComposerAttachmentsCleanup(
  options: {
    rootDirectory?: string | undefined
    onError?: ((error: unknown) => void) | undefined
  } = {},
) {
  setTimeout(() => {
    void cleanupBrowserUploadComposerAttachments({ rootDirectory: options.rootDirectory }).catch(
      (error) => {
        options.onError?.(error)
      },
    )
  }, 0)
}

export async function writeBrowserUploadComposerAttachmentsFromMultipart(
  stream: AsyncIterable<Buffer | string> | Iterable<Buffer | string>,
  contentType: string | string[] | undefined,
  options: { rootDirectory?: string | undefined } = {},
): Promise<ComposerAttachment[]> {
  const boundary = getMultipartBoundary(contentType)
  const initialBoundary = Buffer.from(`--${boundary}`)
  const partBoundary = Buffer.from(`\r\n--${boundary}`)
  const bodyTailBytes = partBoundary.length + finalBoundarySuffix.length + crlf.length
  const uploadDirectory = path.join(getUploadRootDirectory(options.rootDirectory), randomUUID())

  let uploadDirectoryCreated = false
  const activeFileRef: { current: MultipartUploadFile | null } = { current: null }
  let buffer = Buffer.alloc(0)
  const parserState: { current: 'initial-boundary' | 'headers' | 'body' | 'done' } = {
    current: 'initial-boundary',
  }
  let fileCount = 0
  let totalBytes = 0
  const attachments: ComposerAttachment[] = []

  async function ensureUploadDirectory() {
    if (uploadDirectoryCreated) return
    await mkdir(uploadDirectory, { recursive: true, mode: 0o700 })
    uploadDirectoryCreated = true
  }

  async function startFile(headers: Map<string, string>) {
    const disposition = headers.get('content-disposition')
    const fieldName = getHeaderParameter(disposition, 'name')
    const fileName = getHeaderParameter(disposition, 'filename')
    if (fieldName !== 'files' || !fileName) {
      activeFileRef.current = null
      return
    }

    fileCount += 1
    if (fileCount > browserUploadAttachmentLimits.maxFiles) {
      throw new Error('Too many uploaded files.')
    }

    await ensureUploadDirectory()
    const type = headers.get('content-type') ?? ''
    const name = getSafeUploadFileName({ name: fileName, type }, fileCount - 1)
    const openedFile = await openUniqueUploadFile(uploadDirectory, name)
    activeFileRef.current = { ...openedFile, name, type, bytes: 0 }
  }

  async function writeActiveFileChunk(chunk: Buffer) {
    if (!activeFileRef.current || chunk.length === 0) return

    activeFileRef.current.bytes += chunk.length
    totalBytes += chunk.length
    if (activeFileRef.current.bytes > browserUploadAttachmentLimits.maxFileBytes) {
      throw new Error('Uploaded file is too large.')
    }
    if (totalBytes > browserUploadAttachmentLimits.maxTotalBytes) {
      throw new Error('Uploaded files are too large.')
    }

    await activeFileRef.current.handle.write(chunk)
  }

  async function finishActiveFile() {
    if (!activeFileRef.current) return

    const finishedFile = activeFileRef.current
    activeFileRef.current = null
    await finishedFile.handle.close()

    if (finishedFile.bytes === 0) {
      throw new Error('Uploaded file is empty.')
    }

    attachments.push({
      path: finishedFile.path,
      name: finishedFile.name,
      kind: finishedFile.type.startsWith('image/') ? 'image' : getAttachmentKind(finishedFile.path),
    })
  }

  function consumeBoundarySuffix() {
    if (startsWithBuffer(buffer, finalBoundarySuffix)) {
      buffer = buffer.subarray(finalBoundarySuffix.length)
      parserState.current = 'done'
      return true
    }

    if (startsWithBuffer(buffer, crlf)) {
      buffer = buffer.subarray(crlf.length)
      parserState.current = 'headers'
      return true
    }

    if (buffer.length < 2) {
      return false
    }

    throw new Error('Malformed multipart upload.')
  }

  function pumpInitialBoundary() {
    const boundaryIndex = buffer.indexOf(initialBoundary)
    if (boundaryIndex < 0) {
      if (buffer.length > initialBoundary.length + crlf.length) {
        throw new Error('Multipart boundary was not found.')
      }
      return false
    }

    if (buffer.length < boundaryIndex + initialBoundary.length + 2) {
      return false
    }

    buffer = buffer.subarray(boundaryIndex + initialBoundary.length)
    return consumeBoundarySuffix()
  }

  async function pumpHeaders() {
    const headerEndIndex = buffer.indexOf(multipartHeaderSeparator)
    if (headerEndIndex < 0) {
      if (buffer.length > multipartHeaderBytesLimit) {
        throw new Error('Multipart headers are too large.')
      }
      return false
    }

    const rawHeaders = buffer.subarray(0, headerEndIndex).toString('utf8')
    buffer = buffer.subarray(headerEndIndex + multipartHeaderSeparator.length)
    await startFile(parseMultipartHeaders(rawHeaders))
    parserState.current = 'body'
    return true
  }

  async function pumpBody() {
    const boundaryIndex = buffer.indexOf(partBoundary)
    if (boundaryIndex < 0) {
      if (buffer.length <= bodyTailBytes) {
        return false
      }

      const safeWriteLength = buffer.length - bodyTailBytes
      await writeActiveFileChunk(buffer.subarray(0, safeWriteLength))
      buffer = buffer.subarray(safeWriteLength)
      return true
    }

    if (buffer.length < boundaryIndex + partBoundary.length + 2) {
      return false
    }

    await writeActiveFileChunk(buffer.subarray(0, boundaryIndex))
    await finishActiveFile()
    buffer = buffer.subarray(boundaryIndex + partBoundary.length)
    return consumeBoundarySuffix()
  }

  async function pumpBuffer() {
    while (parserState.current !== 'done') {
      const pumped =
        parserState.current === 'initial-boundary'
          ? pumpInitialBoundary()
          : parserState.current === 'headers'
            ? await pumpHeaders()
            : await pumpBody()
      if (!pumped) return
    }
  }

  try {
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, getChunkBuffer(chunk)])
      await pumpBuffer()
    }

    if (parserState.current !== 'done') {
      throw new Error('Multipart upload ended before the final boundary.')
    }

    return attachments
  } catch (error) {
    if (activeFileRef.current) {
      await activeFileRef.current.handle.close().catch(() => undefined)
    }
    if (uploadDirectoryCreated) {
      await rm(uploadDirectory, { recursive: true, force: true })
    }
    throw error
  }
}
