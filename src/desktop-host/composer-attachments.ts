import { readdir, realpath, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import { getAttachmentKind } from '../../shared/composer-attachments'
import type {
  ComposerFilePickerEntry,
  ComposerFilePickerState,
} from '../../shared/desktop-contracts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory'
import { isPathWithinRoot, makeComposerAttachmentSearch } from './composer-attachment-search'

const searchAttachments = Effect.runSync(makeComposerAttachmentSearch)

export function searchComposerAttachmentEntries(input: Parameters<typeof searchAttachments>[0]) {
  return Effect.runPromise(searchAttachments(input))
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

export async function normalizeDialogFilePaths(filePaths: string[]) {
  const normalized: string[] = []

  for (let index = 0; index < filePaths.length; index += 1) {
    let candidate = filePaths[index]?.trim()
    if (!candidate) {
      continue
    }

    while (!(await pathExists(candidate)) && index + 1 < filePaths.length) {
      index += 1
      candidate = `${candidate},${filePaths[index] ?? ''}`
    }

    normalized.push(candidate)
  }

  return normalized
}

export async function listComposerAttachmentEntries(request: {
  projectId?: string | null | undefined
  path?: string | null | undefined
  rootPath?: string | null | undefined
}): Promise<ComposerFilePickerState> {
  const homePath = os.homedir()
  const rootPath = await realpath(
    path.resolve(request.rootPath ?? request.projectId ?? getDesktopWorkingDirectory()),
  )
  const requestedPath = await realpath(path.resolve(request.path ?? rootPath)).catch(() => rootPath)
  const currentPath = isPathWithinRoot(requestedPath, rootPath) ? requestedPath : rootPath
  const directoryEntries = await readdir(currentPath, { withFileTypes: true })

  const entries: ComposerFilePickerEntry[] = directoryEntries
    .flatMap((entry) => {
      if (entry.name.startsWith('.')) return []
      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        return [
          {
            path: entryPath,
            name: entry.name,
            kind: 'directory',
          } satisfies ComposerFilePickerEntry,
        ]
      }

      return [
        {
          path: entryPath,
          name: entry.name,
          kind: getAttachmentKind(entryPath),
        } satisfies ComposerFilePickerEntry,
      ]
    })
    .sort((left, right) => {
      if (left.kind === 'directory' && right.kind !== 'directory') {
        return -1
      }

      if (left.kind !== 'directory' && right.kind === 'directory') {
        return 1
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    })

  return {
    homePath,
    rootPath,
    currentPath,
    parentPath: currentPath === rootPath ? null : path.dirname(currentPath),
    entries,
  }
}
