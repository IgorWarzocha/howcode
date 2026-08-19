import type { PiTreeFilterMode } from './desktop-settings-contracts.ts'
import type { SessionTreeListRow } from './session-tree-model.ts'

export { buildSessionTreeListFromPiTree } from './session-tree-mapper'
export type { SessionTreeList, SessionTreeListRow } from './session-tree-model.ts'

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
