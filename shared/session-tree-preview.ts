import type { SessionPathEntry } from './thread-history.ts'

export type SessionTreePreviewPathEntry = SessionPathEntry & {
  parentId?: string | null | undefined
}

/** Walk parentId chain from target to root (inclusive). Entries must include bookkeeping nodes. */
export function buildPathEntriesToEntryId(
  entries: readonly SessionTreePreviewPathEntry[],
  targetEntryId: string,
): SessionPathEntry[] | null {
  const byId = new Map<string, SessionTreePreviewPathEntry>()
  for (const entry of entries) {
    byId.set(entry.id, entry)
  }

  const path: SessionPathEntry[] = []
  let current: string | null = targetEntryId
  const visited = new Set<string>()

  while (current) {
    if (visited.has(current)) return null
    visited.add(current)
    const entry = byId.get(current)
    if (!entry) return null
    path.unshift(entry)
    const parentId = entry.parentId ?? null
    if (parentId === null || parentId === entry.id) break
    current = parentId
  }

  return path.length > 0 ? path : null
}
