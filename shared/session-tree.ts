import type { PiTreeFilterMode } from './desktop-settings-contracts.ts'

export { buildSessionTreeListFromPiTree } from './session-tree-mapper'

/** Flat session tree row for composer UI (mapped from Pi SessionManager.getTree()). */
export type SessionTreeListRow = {
  id: string
  parentId: string | null
  depth: number
  label: string
  customLabel?: string | undefined
  meta?: string | undefined
  kind: 'user' | 'assistant' | 'tool' | 'branch' | 'summary' | 'system' | 'other'
  isLeaf: boolean
  isOnActivePath: boolean
  /** Assistant turn with only tool calls (no user-visible text). Used for Pi default/no-tools filters. */
  assistantToolOnly?: boolean | undefined
}

export type SessionTreeList = {
  leafId: string | null
  rows: SessionTreeListRow[]
}

export function filterSessionTreeListRows(
  rows: readonly SessionTreeListRow[],
  mode: PiTreeFilterMode,
  leafId: string | null,
): SessionTreeListRow[] {
  return rows.filter((row) => passesPiAlignedTreeFilter(row, mode, leafId))
}

function passesDefaultComposerTreeRow(row: SessionTreeListRow): boolean {
  if (row.kind === 'tool' || row.kind === 'system' || row.kind === 'other') return false
  return true
}

function passesPiAlignedTreeFilter(
  row: SessionTreeListRow,
  mode: PiTreeFilterMode,
  leafId: string | null,
): boolean {
  const isCurrentLeaf = row.id === leafId
  if (row.assistantToolOnly && !isCurrentLeaf) return false

  switch (mode) {
    case 'user-only':
      return row.kind === 'user'
    case 'no-tools':
      return passesDefaultComposerTreeRow(row)
    case 'labeled-only':
      return Boolean(row.customLabel?.trim())
    case 'all':
      return true
    default:
      return passesDefaultComposerTreeRow(row)
  }
}
