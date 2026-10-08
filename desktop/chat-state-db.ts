import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import type { ChatSidebarState, ChatThread } from '../shared/desktop-contracts.ts'
import { databaseOperation } from './thread-state-db/db.ts'
import { mapThreadRow } from './thread-state-db/mappers.ts'
import { decodePersistedRows, ThreadRowSchema } from './thread-state-db/row-schema.ts'
import {
  moveWorkspaceChat,
  reconcileWorkspaceOrganization,
  renameWorkspace,
} from './thread-state-db/workspace-organization.ts'

export const syncWorkspaceOrganization = databaseOperation(reconcileWorkspaceOrganization)

const ChatGroupRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  collapsed: Schema.Number,
  directoryId: Schema.NullOr(Schema.String),
})

const ChatThreadGroupRowSchema = Schema.Struct({
  ...ThreadRowSchema.fields,
  groupId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  isChat: Schema.Number,
})

type ChatThreadGroupRow = typeof ChatThreadGroupRowSchema.Type

const createChatGroupOperation = Effect.fn('ChatState.createGroup')(function* (name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a workspace name.')
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

export const renameChatGroup = databaseOperation(renameWorkspace)

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

export const moveChatThread = databaseOperation(moveWorkspaceChat)

const deleteChatThreadOperation = Effect.fn('ChatState.deleteThread')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe('DELETE FROM chat_conversations WHERE conversation_id = ?', [conversationId])
})

export const deleteChatThread = databaseOperation(deleteChatThreadOperation)

function mapChatThreadRow(row: ChatThreadGroupRow): ChatThread {
  return {
    ...mapThreadRow(row),
    groupId: row.groupId,
    projectId: row.projectId,
    isChat: Boolean(row.isChat),
  }
}

const getChatSidebarStateOperation = Effect.fn('ChatState.getSidebarState')(function* (
  selectedGroupId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* reconcileWorkspaceOrganization([])
  const groups: ChatSidebarState['groups'] = decodePersistedRows(
    ChatGroupRowSchema,
    yield* sql.unsafe(
      `
        SELECT id, name, order_index AS orderIndex, collapsed, directory_id AS directoryId
        FROM chat_groups
        WHERE directory_id IS NULL OR EXISTS (
          SELECT 1 FROM projects WHERE cwd = chat_groups.directory_id AND hidden = 0
        )
        ORDER BY order_index ASC, name COLLATE NOCASE ASC
      `,
    ),
    'chat group',
  ).map((group) => ({
    id: group.id,
    name: group.name,
    orderIndex: group.orderIndex,
    collapsed: Boolean(group.collapsed),
    directoryId: group.directoryId,
    threads: [],
  }))

  const rows = decodePersistedRows(
    ChatThreadGroupRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.cwd AS projectId,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS summary,
          conversation_facts.running AS running,
          COALESCE(conversation_inbox.unread, 0) AS unread,
          conversation_facts.pinned AS pinned,
          conversation_facts.branch_name AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs,
          conversation_facts.workspace_id AS groupId,
          CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
        FROM conversation_facts
        LEFT JOIN chat_conversations ON chat_conversations.conversation_id = conversation_facts.conversation_id
        LEFT JOIN conversation_inbox ON conversation_inbox.conversation_id = conversation_facts.conversation_id
        WHERE conversation_facts.deleted = 0 AND conversation_facts.archived = 0
        ORDER BY conversation_facts.pinned DESC, COALESCE(chat_conversations.order_index, conversation_facts.last_modified_ms) DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
    ),
    'chat thread',
  )

  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const ungroupedThreads: ChatThread[] = []
  for (const row of rows) {
    const thread = mapChatThreadRow(row)
    const group = thread.groupId ? groupsById.get(thread.groupId) : null
    if (group) group.threads.push(thread)
    else ungroupedThreads.push(thread)
  }

  return { groups, ungroupedThreads, selectedGroupId }
})

export const getChatSidebarState: (selectedGroupId?: string | null) => ChatSidebarState =
  databaseOperation(getChatSidebarStateOperation)
