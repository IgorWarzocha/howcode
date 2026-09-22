const pathSeparatorPattern = /[\\/]/
const rawClipboardFormatPattern = /^electron application\/osclipboard;format="(.*)"$/u

import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { app, clipboard, dialog, nativeImage, shell } from 'electron'
import { getAttachmentKind } from '../../../../../shared/composer-attachments'
import { getDesktopWorkingDirectory } from '../../../../../shared/desktop-working-directory'
import { getSafeExternalUrl } from '../../../../../shared/external-url'
import { normalizeDialogFilePaths } from '../../../../desktop-host/composer-attachments'
import {
  createSystemRequestHandlers,
  type DesktopSystemRequestCapabilities,
} from '../../../../desktop-host/desktop-requests/system'
import { parseClipboardFilePaths } from './clipboard-file-paths'

const clipboardImageTempDir = path.join(tmpdir(), 'howcode-clipboard-images')
const maxClipboardImagePixels = 32_000_000
const maxClipboardImageBytes = 25 * 1024 * 1024

function isClipboardImageWithinLimits(size: { width: number; height: number }) {
  const width = Math.max(0, Math.floor(size.width))
  const height = Math.max(0, Math.floor(size.height))
  return width > 0 && height > 0 && width * height <= maxClipboardImagePixels
}

async function writeClipboardImageToTempFile(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > maxClipboardImageBytes) {
    return null
  }

  await mkdir(clipboardImageTempDir, { recursive: true, mode: 0o700 })

  const filePath = path.join(clipboardImageTempDir, `howcode-clipboard-${randomUUID()}.png`)
  await writeFile(filePath, buffer, { mode: 0o600 })
  return filePath
}

async function clearClipboardImageTempFiles() {
  let entries: Array<{ isFile(): boolean; name: string }>
  try {
    entries = await readdir(clipboardImageTempDir, { withFileTypes: true })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return { clearedCount: 0, clearFailedCount: 0 }
    }

    return { clearedCount: 0, clearFailedCount: 1 }
  }

  const targets = entries.filter(
    (entry) =>
      entry.isFile() && entry.name.startsWith('howcode-clipboard-') && entry.name.endsWith('.png'),
  )
  const results = await Promise.allSettled(
    targets.map((entry) => rm(path.join(clipboardImageTempDir, entry.name), { force: true })),
  )
  return {
    clearedCount: results.filter((result) => result.status === 'fulfilled').length,
    clearFailedCount: results.filter((result) => result.status === 'rejected').length,
  }
}

const capabilities = {
  clearClipboardImages: clearClipboardImageTempFiles,
  pickComposerAttachments: async ({ projectId }) => {
    const result = await dialog.showOpenDialog({
      defaultPath: projectId ?? getDesktopWorkingDirectory(),
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled) return []
    const normalizedFilePaths = await normalizeDialogFilePaths(result.filePaths)
    return normalizedFilePaths.flatMap((filePath) =>
      filePath
        ? [
            {
              path: filePath,
              name: filePath.split(pathSeparatorPattern).pop() ?? filePath,
              kind: getAttachmentKind(filePath),
            },
          ]
        : [],
    )
  },
  readClipboardSnapshot: async ({ formats: requestedFormats }) => {
    const items = await clipboard.read()
    const entries = items.flatMap((item) =>
      item.types.map((type) => ({
        item,
        type,
        format: rawClipboardFormatPattern.exec(type)?.[1] ?? type,
      })),
    )
    const formats = Array.isArray(requestedFormats)
      ? requestedFormats.filter((format) => typeof format === 'string' && format.length > 0)
      : [...new Set(entries.map(({ format }) => format))]
    const valuesByFormat = Object.fromEntries(
      await Promise.all(
        formats.map(async (format) => {
          const entry = entries.find(
            (candidate) => candidate.format === format || candidate.type === format,
          )
          if (!entry || entry.type.startsWith('image/')) return [format, ''] as const
          try {
            const payload = await entry.item.getType(entry.type)
            return [format, payload instanceof Blob ? await payload.text() : ''] as const
          } catch {
            return [format, ''] as const
          }
        }),
      ),
    )

    if (!valuesByFormat['text/plain']) valuesByFormat['text/plain'] = await clipboard.readText()
    return { formats, valuesByFormat }
  },
  readClipboardFilePaths: async () => {
    const items = await clipboard.read()
    const uriLists = await Promise.all(
      items
        .filter((item) => item.types.includes('text/uri-list'))
        .map(async (item) => {
          const payload = await item.getType('text/uri-list')
          return payload instanceof Blob ? await payload.text() : ''
        }),
    )
    return {
      filePaths: parseClipboardFilePaths(uriLists.join('\r\n')),
      text: (await clipboard.readText()) || null,
    }
  },
  readClipboardImage: async () => {
    const items = await clipboard.read()
    const imageEntry = items
      .flatMap((item) => item.types.map((type) => ({ item, type })))
      .find(({ type }) => type === 'image/png' || type === 'image/jpeg')
    if (!imageEntry) return null
    const payload = await imageEntry.item.getType(imageEntry.type)
    if (!(payload instanceof Blob) || payload.size > maxClipboardImageBytes) return null
    const image = nativeImage.createFromBuffer(Buffer.from(await payload.arrayBuffer()))
    if (image.isEmpty() || !isClipboardImageWithinLimits(image.getSize())) return null
    const filePath = await writeClipboardImageToTempFile(image.toPNG())
    return filePath ? { path: filePath, mimeType: 'image/png' } : null
  },
  openExternal: async ({ url }) => {
    const safeUrl = getSafeExternalUrl(url)
    if (!safeUrl) return { ok: false }
    try {
      await shell.openExternal(safeUrl)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  openPath: async ({ path: targetPath }) => {
    try {
      return { ok: (await shell.openPath(targetPath)) === '' }
    } catch {
      return { ok: false }
    }
  },
  getDownloadsPath: () => app.getPath('downloads'),
  prepareDownloadsDirectory: async () => undefined,
} satisfies DesktopSystemRequestCapabilities

export function createSystemHandlers() {
  return createSystemRequestHandlers(capabilities)
}
