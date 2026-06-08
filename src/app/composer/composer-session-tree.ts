import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  filterSessionTreeListRows,
  type SessionTreeList,
  type SessionTreeListRow,
} from '@howcode/shared/session-tree'

export type ComposerSessionTreeRow = {
  id: string
  parentId: string | null
  depth: number
  label: string
  customLabel?: string | undefined
  meta?: string | undefined
  kind: SessionTreeListRow['kind']
  isLeaf: boolean
  isOnActivePath: boolean
  assistantToolOnly?: boolean | undefined
}

export function isComposerSessionTreePanelVisible(open: boolean, forceHidden: boolean) {
  if (forceHidden) return false
  return open
}

function toComposerRow(row: SessionTreeListRow): ComposerSessionTreeRow {
  return {
    id: row.id,
    parentId: row.parentId,
    depth: row.depth,
    label: row.label,
    customLabel: row.customLabel,
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
