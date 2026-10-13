import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import type { WorkspaceChat, WorkspaceNavigationState } from '../shared/desktop-contracts.ts'
import { DEFAULT_WORKSPACE_ID } from '../shared/desktop-workspace-contracts.ts'
import { databaseOperation } from './chat-repository/db.ts'
import { mapChatRow } from './chat-repository/mappers.ts'
import { ChatRowSchema, decodePersistedRows } from './chat-repository/row-schema.ts'
import {
  ensureDirectoryWorkspace as ensureDirectoryWorkspaceOperation,
  moveWorkspaceChat,
  reconcileWorkspaceOrganization,
  renameWorkspace as renameWorkspaceOperation,
} from './chat-repository/workspace-organization.ts'

export const syncWorkspaceOrganization = databaseOperation(reconcileWorkspaceOrganization)
export const ensureDirectoryWorkspace = databaseOperation(ensureDirectoryWorkspaceOperation)

const WorkspaceRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  collapsed: Schema.Number,
  directoryId: Schema.NullOr(Schema.String),
})

const ChatWorkspaceRowSchema = Schema.Struct({
  ...ChatRowSchema.fields,
  workspaceId: Schema.NullOr(Schema.String),
  directoryId: Schema.String,
  isChat: Schema.Number,
})

type ChatWorkspaceRow = typeof ChatWorkspaceRowSchema.Type

const createWorkspaceOperation = Effect.fn('ChatState.createGroup')(function* (name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a workspace name.')
  const sql = yield* SqlClient.SqlClient
  const id = randomUUID()
  const nextOrderRows = yield* sql.unsafe<{ nextOrder: number }>(
    'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM chat_groups',
  )
  const nextOrderRow = nextOrderRows[0]
  if (!nextOrderRow) throw new Error('Could not determine the next chat workspace order.')
  yield* sql.unsafe('INSERT INTO chat_groups (id, name, order_index) VALUES (?, ?, ?)', [
    id,
    trimmedName,
    nextOrderRow.nextOrder,
  ])
  return yield* getWorkspaceNavigationStateOperation(id)
})

export const createWorkspace: (name: string) => WorkspaceNavigationState =
  databaseOperation(createWorkspaceOperation)

export const renameWorkspace = databaseOperation(renameWorkspaceOperation)

const setWorkspaceCollapsedOperation = Effect.fn('ChatState.setGroupCollapsed')(function* (
  workspaceId: string,
  collapsed: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    'UPDATE chat_groups SET collapsed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [collapsed ? 1 : 0, workspaceId],
  )
})

export const setWorkspaceCollapsed = databaseOperation(setWorkspaceCollapsedOperation)

const reorderWorkspacesOperation = Effect.fn('ChatState.reorderGroups')(function* (
  workspaceIds: string[],
) {
  const sql = yield* SqlClient.SqlClient
  for (const [index, workspaceId] of workspaceIds
    .filter((id) => id !== DEFAULT_WORKSPACE_ID)
    .entries()) {
    yield* sql.unsafe(
      'UPDATE chat_groups SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [index, workspaceId],
    )
  }
})

export const reorderWorkspaces = databaseOperation(reorderWorkspacesOperation)

export const moveChat = databaseOperation(moveWorkspaceChat)

const deleteWorkspaceChatOperation = Effect.fn('ChatState.deleteChat')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe('DELETE FROM chat_conversations WHERE conversation_id = ?', [conversationId])
})

export const deleteWorkspaceChat = databaseOperation(deleteWorkspaceChatOperation)

function mapWorkspaceChatRow(row: ChatWorkspaceRow): WorkspaceChat {
  return {
    ...mapChatRow(row),
    workspaceId: row.workspaceId,
    directoryId: row.directoryId,
    composerProfile: row.isChat ? 'general' : 'coding',
  }
}

const getWorkspaceNavigationStateOperation = Effect.fn('ChatState.getSidebarState')(function* (
  selectedWorkspaceId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* reconcileWorkspaceOrganization([])
  const workspaces: WorkspaceNavigationState['workspaces'] = decodePersistedRows(
    WorkspaceRowSchema,
    yield* sql.unsafe(
      `
        SELECT id, name, order_index AS orderIndex, collapsed, directory_id AS directoryId
        FROM chat_groups
        WHERE directory_id IS NULL OR EXISTS (
          SELECT 1 FROM projects WHERE cwd = chat_groups.directory_id AND hidden = 0
        )
        ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, order_index ASC, name COLLATE NOCASE ASC
      `,
      [DEFAULT_WORKSPACE_ID],
    ),
    'chat workspace',
  ).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    orderIndex: workspace.orderIndex,
    collapsed: Boolean(workspace.collapsed),
    directoryId: workspace.directoryId,
    chats: [],
  }))

  const rows = decodePersistedRows(
    ChatWorkspaceRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.cwd AS directoryId,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS summary,
          conversation_facts.running AS running,
          COALESCE(conversation_inbox.unread, 0) AS unread,
          conversation_facts.pinned AS pinned,
          conversation_facts.branch_name AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs,
          conversation_facts.workspace_id AS workspaceId,
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

  const workspacesById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const unassignedChats: WorkspaceChat[] = []
  for (const row of rows) {
    const chat = mapWorkspaceChatRow(row)
    const workspace = chat.workspaceId ? workspacesById.get(chat.workspaceId) : null
    if (workspace) workspace.chats.push(chat)
    else unassignedChats.push(chat)
  }

  return { workspaces, unassignedChats, selectedWorkspaceId }
})

export const getWorkspaceNavigationState: (
  selectedWorkspaceId?: string | null,
) => WorkspaceNavigationState = databaseOperation(getWorkspaceNavigationStateOperation)
