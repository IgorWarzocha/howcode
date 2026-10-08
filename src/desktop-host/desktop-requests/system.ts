import { readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import {
  listComposerAttachmentEntries,
  searchComposerAttachmentEntries,
} from '../composer-attachments'

type SystemRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listDirectoryDirectoryEntries'
  | 'listComposerAttachmentEntries'
  | 'searchComposerAttachmentEntries'
>

async function listDirectoryDirectoryEntries(request: { path?: string | null | undefined }) {
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

export function createSystemRequestHandlers(): SystemRequestHandlers {
  return {
    listDirectoryDirectoryEntries,
    listComposerAttachmentEntries: (request) => listComposerAttachmentEntries(request),
    searchComposerAttachmentEntries: (request) => searchComposerAttachmentEntries(request),
  }
}
