import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { ComposerSessionTreeRow } from './composer-session-tree'

export function filterSessionTreeRows(
  rows: readonly ComposerSessionTreeRow[],
  mode: PiTreeFilterMode,
): ComposerSessionTreeRow[] {
  return rows.filter((row) => passesSessionTreeFilter(row, mode))
}

function passesSessionTreeFilter(row: ComposerSessionTreeRow, mode: PiTreeFilterMode): boolean {
  switch (mode) {
    case 'user-only':
      return row.kind === 'user'
    case 'no-tools':
      return row.kind !== 'tool'
    case 'labeled-only':
      return Boolean(row.label?.trim())
    case 'all':
      return true
    default:
      return row.kind !== 'system' && row.kind !== 'other'
  }
}
