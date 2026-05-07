const pathSeparatorPattern = /[\\/]/
const leadingDotsPattern = /^\.+/

import { randomUUID } from 'node:crypto'
import { mkdir, open, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { app, clipboard, dialog, shell } from 'electron'
import { getAttachmentKind } from '../../../../../shared/composer-attachments'
import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import { getDesktopWorkingDirectory } from '../../../../../shared/desktop-working-directory'
import { getSafeExternalUrl } from '../../../../../shared/external-url'
import {
  listComposerAttachmentEntries,
  normalizeDialogFilePaths,
  searchComposerAttachmentEntries,
} from '../../../../desktop-host/composer-attachments'
import { readNativeClipboardFilePaths } from './clipboard-file-paths'

type SystemRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'clearClipboardImages'
  | 'pickComposerAttachments'
  | 'readClipboardSnapshot'
  | 'readClipboardFilePaths'
  | 'readClipboardImage'
  | 'getAttachmentKindsForPaths'
  | 'listComposerAttachmentEntries'
  | 'searchComposerAttachmentEntries'
  | 'openExternal'
  | 'openPath'
  | 'saveTextToDownloads'
>

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

async function writeUniqueTextFile(directoryPath: string, fileName: string, content: string) {
  const parsed = path.parse(fileName)
  for (let index = 0; index < 100; index += 1) {
    const candidateName = index === 0 ? fileName : `${parsed.name}-${index + 1}${parsed.ext}`
    const candidatePath = path.join(directoryPath, candidateName)
    try {
      const file = await open(candidatePath, 'wx', 0o600)
      try {
        await file.writeFile(content, 'utf8')
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
  throw new Error('Could not find an unused file name in Downloads.')
}

export function createSystemHandlers(): SystemRequestHandlers {
  return {
    clearClipboardImages: clearClipboardImageTempFiles,
    pickComposerAttachments: async ({ projectId }) => {
      const result = await dialog.showOpenDialog({
        defaultPath: projectId ?? getDesktopWorkingDirectory(),
        properties: ['openFile', 'multiSelections'],
      })

      if (result.canceled) {
        return []
      }

      const normalizedFilePaths = await normalizeDialogFilePaths(result.filePaths)

      return normalizedFilePaths
        .filter((filePath) => filePath.length > 0)
        .map((filePath) => ({
          path: filePath,
          name: filePath.split(pathSeparatorPattern).pop() ?? filePath,
          kind: getAttachmentKind(filePath),
        }))
    },
    readClipboardSnapshot: ({ formats: requestedFormats }) => {
      const formats = Array.isArray(requestedFormats)
        ? requestedFormats.filter((format) => typeof format === 'string' && format.length > 0)
        : clipboard.availableFormats()
      const valuesByFormat = Object.fromEntries(
        formats.map((format) => {
          try {
            return [format, clipboard.read(format)] as const
          } catch {
            return [format, ''] as const
          }
        }),
      )

      if (!valuesByFormat['text/plain']) {
        valuesByFormat['text/plain'] = clipboard.readText()
      }

      return { formats, valuesByFormat }
    },
    readClipboardFilePaths: () => readNativeClipboardFilePaths(),
    readClipboardImage: async () => {
      const image = clipboard.readImage()
      if (image.isEmpty()) {
        return null
      }

      if (!isClipboardImageWithinLimits(image.getSize())) {
        return null
      }

      const filePath = await writeClipboardImageToTempFile(image.toPNG())
      if (!filePath) {
        return null
      }

      return { path: filePath, mimeType: 'image/png' }
    },
    getAttachmentKindsForPaths: async ({ paths }) => {
      const uniquePaths = [...new Set(Array.isArray(paths) ? paths : [])].filter(
        (candidatePath): candidatePath is string =>
          typeof candidatePath === 'string' && candidatePath.trim().length > 0,
      )

      const entries = await Promise.all(
        uniquePaths.map(async (attachmentPath) => {
          try {
            const stats = await stat(attachmentPath)
            return [
              attachmentPath,
              stats.isDirectory() ? 'directory' : getAttachmentKind(attachmentPath),
            ] as const
          } catch {
            return [attachmentPath, null] as const
          }
        }),
      )

      return Object.fromEntries(entries)
    },
    listComposerAttachmentEntries: (request) => listComposerAttachmentEntries(request),
    searchComposerAttachmentEntries: (request) => searchComposerAttachmentEntries(request),
    openExternal: async ({ url }) => {
      const safeUrl = getSafeExternalUrl(url)
      if (!safeUrl) {
        return { ok: false }
      }

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
    saveTextToDownloads: async ({ fileName, content }) => {
      const safeFileName = fileName
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(leadingDotsPattern, '')
        .trim()
      if (!safeFileName) return { ok: false, error: 'Invalid file name.' }
      const downloadsPath = app.getPath('downloads')
      try {
        const targetPath = await writeUniqueTextFile(downloadsPath, safeFileName, content)
        return { ok: true, path: targetPath }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
