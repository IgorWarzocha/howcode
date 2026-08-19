import { open, readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { getAttachmentKind } from '../../../shared/composer-attachments'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import {
  listComposerAttachmentEntries,
  searchComposerAttachmentEntries,
} from '../composer-attachments'

type SystemRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'clearClipboardImages'
  | 'pickComposerAttachments'
  | 'listProjectDirectoryEntries'
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

type PlatformSystemHandlers = Pick<
  SystemRequestHandlers,
  | 'clearClipboardImages'
  | 'pickComposerAttachments'
  | 'readClipboardSnapshot'
  | 'readClipboardFilePaths'
  | 'readClipboardImage'
  | 'openExternal'
  | 'openPath'
>

export type DesktopSystemRequestCapabilities = PlatformSystemHandlers & {
  getDownloadsPath: () => string
  prepareDownloadsDirectory: (directoryPath: string) => Promise<void>
}

const leadingDotsPattern = /^\.+/

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

async function listProjectDirectoryEntries(request: { path?: string | null | undefined }) {
  const homePath = homedir()
  const trimmedRequestPath = request.path?.trim() ?? ''
  const requestedPath = trimmedRequestPath || homePath
  const currentPath = await realpath(path.resolve(requestedPath)).catch(() =>
    path.resolve(requestedPath),
  )
  const directoryEntries = await readdir(currentPath, { withFileTypes: true })
  const pendingEntries: Promise<{ path: string; name: string; kind: 'directory' } | null>[] = []
  for (const entry of directoryEntries) {
    if (entry.name.startsWith('.') || !(entry.isDirectory() || entry.isSymbolicLink())) continue
    pendingEntries.push(
      (async () => {
        const entryPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) return { path: entryPath, name: entry.name, kind: 'directory' }
        try {
          const stats = await stat(entryPath)
          return stats.isDirectory()
            ? { path: entryPath, name: entry.name, kind: 'directory' }
            : null
        } catch {
          return null
        }
      })(),
    )
  }
  const entries: { path: string; name: string; kind: 'directory' }[] = []
  for (const entry of await Promise.all(pendingEntries)) {
    if (entry) entries.push(entry)
  }
  entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  )

  return {
    homePath,
    currentPath,
    parentPath: path.dirname(currentPath) === currentPath ? null : path.dirname(currentPath),
    entries,
  }
}

export function createSystemRequestHandlers(
  capabilities: DesktopSystemRequestCapabilities,
): SystemRequestHandlers {
  return {
    clearClipboardImages: capabilities.clearClipboardImages,
    pickComposerAttachments: capabilities.pickComposerAttachments,
    listProjectDirectoryEntries,
    readClipboardSnapshot: capabilities.readClipboardSnapshot,
    readClipboardFilePaths: capabilities.readClipboardFilePaths,
    readClipboardImage: capabilities.readClipboardImage,
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
    openExternal: capabilities.openExternal,
    openPath: capabilities.openPath,
    saveTextToDownloads: async ({ fileName, content }) => {
      const safeFileName = fileName
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(leadingDotsPattern, '')
        .trim()
      if (!safeFileName) return { ok: false, error: 'Invalid file name.' }
      const downloadsPath = capabilities.getDownloadsPath()
      try {
        await capabilities.prepareDownloadsDirectory(downloadsPath)
        const filePath = await writeUniqueTextFile(downloadsPath, safeFileName, content)
        return { ok: true, path: filePath }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
