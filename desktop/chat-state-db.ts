import { randomUUID } from 'node:crypto'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { ChatSidebarState, ChatThread } from '../shared/desktop-contracts.ts'
import { getChatSessionDir } from './chat-session-dir.ts'
import { databaseOperation } from './thread-state-db/db.ts'
import { mapThreadRow } from './thread-state-db/mappers.ts'
import {
  decodePersistedRow,
  decodePersistedRows,
  ThreadRowSchema,
} from './thread-state-db/row-schema.ts'

const ChatGroupRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  collapsed: Schema.Number,
})

const ChatThreadGroupRowSchema = Schema.Struct({
  ...ThreadRowSchema.fields,
  groupId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
})

type ChatThreadGroupRow = typeof ChatThreadGroupRowSchema.Type

export function isChatSessionPath(sessionPath: string) {
  const chatSessionDir = getChatSessionDir()
  const relativePath = path.relative(chatSessionDir, sessionPath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

const createChatGroupOperation = Effect.fn('ChatState.createGroup')(function* (name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a group name.')
  const sql = yield* SqlClient.SqlClient
  const id = randomUUID()
  const nextOrderRows = yield* sql.unsafe<{ nextOrder: number }>(
    'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM chat_groups',
  )
  const nextOrderRow = nextOrderRows[0]
  if (!nextOrderRow) throw new Error('Could not determine the next chat group order.')
  yield* sql.unsafe('INSERT INTO chat_groups (id, name, order_index) VALUES (?, ?, ?)', [
    id,
    trimmedName,
    nextOrderRow.nextOrder,
  ])
  return yield* getChatSidebarStateOperation(id)
})

export const createChatGroup: (name: string) => ChatSidebarState =
  databaseOperation(createChatGroupOperation)

const renameChatGroupOperation = Effect.fn('ChatState.renameGroup')(function* (
  groupId: string,
  name: string,
) {
  const trimmedName = name.trim()
  if (!(groupId && trimmedName)) return
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    'UPDATE chat_groups SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [trimmedName, groupId],
  )
})

export const renameChatGroup = databaseOperation(renameChatGroupOperation)

const setChatGroupCollapsedOperation = Effect.fn('ChatState.setGroupCollapsed')(function* (
  groupId: string,
  collapsed: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    'UPDATE chat_groups SET collapsed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [collapsed ? 1 : 0, groupId],
  )
})

export const setChatGroupCollapsed = databaseOperation(setChatGroupCollapsedOperation)

const reorderChatGroupsOperation = Effect.fn('ChatState.reorderGroups')(function* (
  groupIds: string[],
) {
  const sql = yield* SqlClient.SqlClient
  for (const [index, groupId] of groupIds.entries()) {
    yield* sql.unsafe(
      'UPDATE chat_groups SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [index, groupId],
    )
  }
})

export const reorderChatGroups = databaseOperation(reorderChatGroupsOperation)

const moveChatThreadOperation = Effect.fn('ChatState.moveThread')(function* (
  sessionPath: string,
  groupId: string | null,
) {
  yield* upsertChatThreadOperation({ sessionPath, groupId, updateGroup: true })
})

export const moveChatThread = databaseOperation(moveChatThreadOperation)

const deleteChatThreadOperation = Effect.fn('ChatState.deleteThread')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe('DELETE FROM chat_threads WHERE session_path = ?', [sessionPath])
})

export const deleteChatThread = databaseOperation(deleteChatThreadOperation)

type UpsertChatThreadOptions = {
  sessionPath: string
  groupId?: string | undefined | null | undefined
  updateGroup?: boolean | undefined
}

const upsertChatThreadOperation = Effect.fn('ChatState.upsertThread')(function* (
  options: UpsertChatThreadOptions,
) {
  if (!isChatSessionPath(options.sessionPath)) return
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
        INSERT INTO chat_threads (session_path, group_id)
        VALUES (?, ?)
        ON CONFLICT(session_path) DO UPDATE SET
          group_id = CASE WHEN ? THEN excluded.group_id ELSE chat_threads.group_id END,
          updated_at = CURRENT_TIMESTAMP
      `,
    [options.sessionPath, options.groupId ?? null, options.updateGroup ? 1 : 0],
  )
})

export const upsertChatThread = databaseOperation(upsertChatThreadOperation)

function mapChatThreadRow(input: unknown): ChatThread {
  const row: ChatThreadGroupRow = decodePersistedRow(ChatThreadGroupRowSchema, input, 'chat thread')
  return { ...mapThreadRow(row), groupId: row.groupId, projectId: row.projectId }
}

const getChatSidebarStateOperation = Effect.fn('ChatState.getSidebarState')(function* (
  selectedGroupId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient
  const groups: ChatSidebarState['groups'] = decodePersistedRows(
    ChatGroupRowSchema,
    yield* sql.unsafe(
      `
        SELECT id, name, order_index AS orderIndex, collapsed
        FROM chat_groups
        ORDER BY order_index ASC, name COLLATE NOCASE ASC
      `,
    ),
    'chat group',
  ).map((group) => ({
    id: group.id,
    name: group.name,
    orderIndex: group.orderIndex,
    collapsed: Boolean(group.collapsed),
    threads: [],
  }))

  const rows = decodePersistedRows(
    ChatThreadGroupRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          threads.id AS id,
          threads.cwd AS projectId,
          threads.title AS title,
          threads.session_path AS sessionPath,
          COALESCE(inbox_items.last_assistant_preview, threads.last_assistant_preview) AS summary,
          threads.running AS running,
          COALESCE(inbox_items.unread, 0) AS unread,
          threads.pinned AS pinned,
          threads.last_modified_ms AS lastModifiedMs,
          chat_threads.group_id AS groupId
        FROM threads
        LEFT JOIN chat_threads ON chat_threads.session_path = threads.session_path
        LEFT JOIN inbox_items ON inbox_items.session_path = threads.session_path
        WHERE threads.archived = 0
        ORDER BY threads.pinned DESC, COALESCE(chat_threads.order_index, threads.last_modified_ms) DESC, threads.title COLLATE NOCASE ASC
      `,
    ),
    'chat thread',
  )

  const chatRows = rows.filter((row) => isChatSessionPath(row.sessionPath))

  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const ungroupedThreads: ChatThread[] = []
  for (const row of chatRows) {
    const thread = mapChatThreadRow(row)
    const group = thread.groupId ? groupsById.get(thread.groupId) : null
    if (group) group.threads.push(thread)
    else ungroupedThreads.push(thread)
  }

  return { groups, ungroupedThreads, selectedGroupId }
})

export const getChatSidebarState: (selectedGroupId?: string | null) => ChatSidebarState =
  databaseOperation(getChatSidebarStateOperation)
