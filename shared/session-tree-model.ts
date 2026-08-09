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
