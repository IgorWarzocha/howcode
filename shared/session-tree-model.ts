import type { SessionTreeListRowSchema, SessionTreeListSchema } from './session-tree-schema'

/** Flat session tree row for composer UI (mapped from Pi SessionManager.getTree()). */
export type SessionTreeListRow = typeof SessionTreeListRowSchema.Type

export type SessionTreeList = typeof SessionTreeListSchema.Type
