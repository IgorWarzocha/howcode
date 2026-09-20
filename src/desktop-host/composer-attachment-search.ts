import type { Dirent } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import * as Cache from 'effect/Cache'
import * as Effect from 'effect/Effect'
import { getAttachmentKind } from '../../shared/composer-attachments'
import type {
  ComposerFilePickerEntry,
  ComposerFileSearchEntry,
} from '../../shared/desktop-contracts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory'

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
// Each root can retain up to 50,000 entries. Bound roots as well as traversal.
const searchCacheCapacity = 8

type SearchIndexEntry = {
  path: string
  name: string
  relativePath: string
  lowerRelativePath: string
  kind: ComposerFilePickerEntry['kind']
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
    const inspected = await Effect.runPromise(
      Effect.forEach(
        entriesToVisit,
        (entry) => {
          if (entry.name.startsWith('.') || !entry.isSymbolicLink())
            return Effect.succeed({ entry, symlinkKind: null })
          return Effect.promise(() =>
            getSymlinkSearchEntryKind(path.join(currentPath, entry.name), rootPath),
          ).pipe(Effect.map((symlinkKind) => ({ entry, symlinkKind })))
        },
        { concurrency: 16 },
      ),
    )
    // Resolve metadata concurrently, but retain directory order for capped traversal and ranking.
    for (const { entry, symlinkKind } of inspected) {
      visitedEntries += 1
      addSearchIndexEntry({
        entries,
        entry,
        symlinkKind,
        currentPath,
        pendingDirectories,
        rootPath,
      })
    }
  }

  return entries
}

function addSearchIndexEntry(input: {
  currentPath: string
  entries: SearchIndexEntry[]
  entry: Dirent
  pendingDirectories: string[]
  rootPath: string
  symlinkKind: Awaited<ReturnType<typeof getSymlinkSearchEntryKind>>
}) {
  if (input.entry.name.startsWith('.')) return

  const entryPath = path.join(input.currentPath, input.entry.name)
  const relativePath = path.relative(input.rootPath, entryPath)
  const kind = input.symlinkKind ?? (input.entry.isDirectory() ? 'directory' : null)

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
  rootPath: string,
): Promise<'directory' | 'text' | 'image' | null> {
  try {
    const resolvedPath = await realpath(entryPath)
    if (!isPathWithinRoot(resolvedPath, rootPath)) return null
    const stats = await stat(resolvedPath)
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

type SearchRequest = {
  projectId?: string | null | undefined
  query?: string | null | undefined
  limit?: number | null | undefined
}

export const makeComposerAttachmentSearch = Effect.gen(function* () {
  const indexes = yield* Cache.make({
    capacity: searchCacheCapacity,
    timeToLive: searchCacheTtlMs,
    // Preserve partial-directory results and their existing 30-second lifetime.
    lookup: (rootPath: string) => Effect.promise(() => buildSearchIndex(rootPath)),
  })

  return Effect.fn('ComposerAttachments.search')(function* (input: SearchRequest) {
    const rootPath = yield* Effect.tryPromise({
      try: () => realpath(input.projectId ?? getDesktopWorkingDirectory()),
      catch: (error) => error,
    })
    const index = yield* Cache.get(indexes, rootPath)
    return searchIndex(index, input)
  })
})

function searchIndex(index: SearchIndexEntry[], input: SearchRequest): ComposerFileSearchEntry[] {
  const query = (input.query?.trim() ?? '').toLowerCase()
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100))
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

export function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath)
  return (
    relativePath.length === 0 || !(relativePath.startsWith('..') || path.isAbsolute(relativePath))
  )
}
