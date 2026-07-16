import type { Dirent } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getAttachmentKind } from '../../shared/composer-attachments'
import type {
  ComposerFilePickerEntry,
  ComposerFilePickerState,
  ComposerFileSearchEntry,
} from '../../shared/desktop-contracts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory'

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

const ignoredSearchDirectories = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'build',
  'dist',
  'out',
  '.next',
  '.turbo',
  '.vite',
])
const maxVisitedSearchEntries = 50_000
const searchCacheTtlMs = 30_000

type SearchIndexEntry = {
  path: string
  name: string
  relativePath: string
  lowerRelativePath: string
  kind: ComposerFilePickerEntry['kind']
}

type SearchIndex = {
  entries: SearchIndexEntry[]
  expiresAt: number
}

const searchIndexes = new Map<string, SearchIndex>()

function evictExpiredSearchIndexes(now = Date.now()) {
  for (const [rootPath, index] of searchIndexes) {
    if (index.expiresAt <= now) searchIndexes.delete(rootPath)
  }
}

function scoreFzfMatch(candidate: string, query: string) {
  if (!query) return 0
  let score = 0
  let searchFrom = 0
  let previousIndex = -1

  for (const character of query) {
    const index = candidate.indexOf(character, searchFrom)
    if (index === -1) return null

    score += 1
    if (index === 0 || '/-_ .'.includes(candidate[index - 1] ?? '')) score += 3
    if (previousIndex >= 0 && index === previousIndex + 1) score += 5
    previousIndex = index
    searchFrom = index + 1
  }

  if (candidate.includes(query)) score += 20
  score -= candidate.length / 200
  return score
}

function toFileSearchEntry(entry: SearchIndexEntry) {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    relativePath: entry.relativePath,
  } satisfies ComposerFileSearchEntry
}

function addTopMatch(
  matches: Array<{ entry: SearchIndexEntry; score: number }>,
  match: { entry: SearchIndexEntry; score: number },
  limit: number,
) {
  if (matches.length < limit) {
    matches.push(match)
    return
  }

  let worstIndex = 0
  let worstScore = matches[0]?.score ?? Number.POSITIVE_INFINITY
  for (let index = 1; index < matches.length; index += 1) {
    const score = matches[index]?.score ?? Number.POSITIVE_INFINITY
    if (score < worstScore) {
      worstIndex = index
      worstScore = score
    }
  }
  if (match.score > worstScore) matches[worstIndex] = match
}

async function buildSearchIndex(rootPath: string) {
  evictExpiredSearchIndexes()
  const cachedIndex = searchIndexes.get(rootPath)
  if (cachedIndex && cachedIndex.expiresAt > Date.now()) return cachedIndex.entries

  const entries: SearchIndexEntry[] = []
  const pendingDirectories = [rootPath]
  let visitedEntries = 0

  while (pendingDirectories.length > 0 && visitedEntries < maxVisitedSearchEntries) {
    const currentPath = pendingDirectories.shift()
    if (!currentPath) break

    let directoryEntries: Dirent[]
    try {
      directoryEntries = await readdir(currentPath, { withFileTypes: true })
    } catch {
      continue
    }

    const entriesToVisit = directoryEntries.slice(0, maxVisitedSearchEntries - visitedEntries)
    await entriesToVisit.reduce<Promise<void>>(
      (pending, entry) =>
        pending.then(() => {
          visitedEntries += 1
          return addSearchIndexEntry({ entries, entry, currentPath, pendingDirectories, rootPath })
        }),
      Promise.resolve(),
    )
  }

  searchIndexes.set(rootPath, { entries, expiresAt: Date.now() + searchCacheTtlMs })
  return entries
}

async function addSearchIndexEntry(input: {
  currentPath: string
  entries: SearchIndexEntry[]
  entry: Dirent
  pendingDirectories: string[]
  rootPath: string
}) {
  if (input.entry.name.startsWith('.')) return

  const entryPath = path.join(input.currentPath, input.entry.name)
  const relativePath = path.relative(input.rootPath, entryPath)
  const symlinkKind = input.entry.isSymbolicLink()
    ? await getSymlinkSearchEntryKind(entryPath)
    : null
  const kind = symlinkKind ?? (input.entry.isDirectory() ? 'directory' : null)

  if (kind === 'directory') {
    if (!ignoredSearchDirectories.has(input.entry.name)) input.pendingDirectories.push(entryPath)
    input.entries.push({
      path: entryPath,
      name: input.entry.name,
      relativePath,
      lowerRelativePath: relativePath.toLowerCase(),
      kind: 'directory',
    })
    return
  }

  if (!(kind || input.entry.isFile())) return
  input.entries.push({
    path: entryPath,
    name: input.entry.name,
    relativePath,
    lowerRelativePath: relativePath.toLowerCase(),
    kind: getAttachmentKind(entryPath),
  })
}

async function getSymlinkSearchEntryKind(
  entryPath: string,
): Promise<'directory' | 'text' | 'image' | null> {
  try {
    const stats = await stat(entryPath)
    return stats.isDirectory() ? 'directory' : getAttachmentKind(entryPath)
  } catch {
    return null
  }
}

function compareSearchIndexEntries(left: SearchIndexEntry, right: SearchIndexEntry) {
  if (left.kind === 'directory' && right.kind !== 'directory') return -1
  if (left.kind !== 'directory' && right.kind === 'directory') return 1
  return left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
}

async function resolveComposerSearchRoot(projectPath?: string | null) {
  return realpath(projectPath ?? getDesktopWorkingDirectory())
}

export async function searchComposerAttachmentEntries(input: {
  projectId?: string | null | undefined
  query?: string | null | undefined
  limit?: number | null | undefined
}): Promise<ComposerFileSearchEntry[]> {
  const rootPath = await resolveComposerSearchRoot(input.projectId)
  const query = (input.query?.trim() ?? '').toLowerCase()
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100))
  const index = await buildSearchIndex(rootPath)
  if (!query)
    return index.toSorted(compareSearchIndexEntries).slice(0, limit).map(toFileSearchEntry)

  const matches: Array<{ entry: SearchIndexEntry; score: number }> = []
  for (const entry of index) {
    const score = scoreFzfMatch(entry.lowerRelativePath, query)
    if (score === null) continue
    addTopMatch(matches, { entry, score }, limit)
  }

  return matches
    .sort(
      (left, right) =>
        right.score - left.score || left.entry.relativePath.localeCompare(right.entry.relativePath),
    )
    .map((match) => toFileSearchEntry(match.entry))
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

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath)
  return (
    relativePath.length === 0 || !(relativePath.startsWith('..') || path.isAbsolute(relativePath))
  )
}

export async function listComposerAttachmentEntries(request: {
  projectId?: string | null | undefined
  path?: string | null | undefined
  rootPath?: string | null | undefined
}): Promise<ComposerFilePickerState> {
  const homePath = os.homedir()
  const rootPath = path.resolve(
    request.rootPath ?? request.projectId ?? getDesktopWorkingDirectory(),
  )
  const requestedPath = path.resolve(request.path ?? rootPath)
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
