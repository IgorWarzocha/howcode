import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  filterSessionTreeListRows,
  type SessionTreeList,
  type SessionTreeListRow,
} from '@howcode/shared/session-tree'

export type ComposerSessionTreeRow = {
  id: string
  depth: number
  label: string
  meta?: string | undefined
  kind: SessionTreeListRow['kind']
  isLeaf: boolean
  isOnActivePath: boolean
  assistantToolOnly?: boolean | undefined
}

/** Keep true while session-tree UX is in progress; wire open/close like attachments before ship. */
export const composerSessionTreePanelDevAlwaysOpen = true

export function isComposerSessionTreePanelVisible(open: boolean, forceHidden: boolean) {
  if (forceHidden) return false
  return open || composerSessionTreePanelDevAlwaysOpen
}

function toComposerRow(row: SessionTreeListRow): ComposerSessionTreeRow {
  return {
    id: row.id,
    depth: row.depth,
    label: row.label,
    meta: row.meta,
    kind: row.kind,
    isLeaf: row.isLeaf,
    isOnActivePath: row.isOnActivePath,
    assistantToolOnly: row.assistantToolOnly,
  }
}

export function getComposerSessionTreeRowsFromList(
  list: SessionTreeList | null | undefined,
  treeFilterMode: PiTreeFilterMode = 'no-tools',
): ComposerSessionTreeRow[] {
  if (!list || list.rows.length === 0) return []
  const filtered = filterSessionTreeListRows(list.rows, treeFilterMode, list.leafId)
  return filtered.map(toComposerRow)
}
