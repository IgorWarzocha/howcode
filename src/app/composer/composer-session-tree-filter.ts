import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { ComposerSessionTreeRow } from './composer-session-tree'

export function filterSessionTreeRows(
  rows: readonly ComposerSessionTreeRow[],
  mode: PiTreeFilterMode,
  leafId: string | null = null,
): ComposerSessionTreeRow[] {
  return rows.filter((row) => passesSessionTreeFilter(row, mode, leafId))
}

function passesSessionTreeFilter(
  row: ComposerSessionTreeRow,
  mode: PiTreeFilterMode,
  leafId: string | null,
): boolean {
  const isCurrentLeaf = row.isLeaf && leafId !== null && row.id === leafId
  if (row.assistantToolOnly && !isCurrentLeaf) return false
  switch (mode) {
    case 'user-only':
      return row.kind === 'user'
    case 'no-tools':
      if (row.kind === 'tool' || row.kind === 'system' || row.kind === 'other') return false
      return true
    case 'labeled-only':
      return Boolean(row.label?.trim())
    case 'all':
      return true
    default:
      if (row.kind === 'tool' || row.kind === 'system' || row.kind === 'other') return false
      return true
  }
}
