import type { ComposerSessionTreeRow } from './composer-session-tree'

export function rowHasChildren(rows: readonly ComposerSessionTreeRow[], index: number) {
  const row = rows[index]
  const next = rows[index + 1]
  return Boolean(row && next && next.depth > row.depth)
}

function findParentIndex(rows: readonly ComposerSessionTreeRow[], index: number) {
  const depth = rows[index]?.depth
  if (depth === undefined || depth === 0) return -1
  for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
    const row = rows[candidate]
    if (row && row.depth === depth - 1) return candidate
  }
  return -1
}

export function isSessionTreeRowVisible(
  rows: readonly ComposerSessionTreeRow[],
  index: number,
  collapsedIds: ReadonlySet<string>,
) {
  let parentIndex = findParentIndex(rows, index)
  while (parentIndex >= 0) {
    const parent = rows[parentIndex]
    if (parent && collapsedIds.has(parent.id)) return false
    parentIndex = findParentIndex(rows, parentIndex)
  }
  return true
}

export function getVisibleSessionTreeRowIndices(
  rows: readonly ComposerSessionTreeRow[],
  collapsedIds: ReadonlySet<string>,
) {
  const indices: number[] = []
  for (let index = 0; index < rows.length; index += 1) {
    if (isSessionTreeRowVisible(rows, index, collapsedIds)) indices.push(index)
  }
  return indices
}
