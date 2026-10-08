import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { withDatabaseTransaction } from './write-transaction.ts'

// Persisted chat_groups are now universal workspaces. The old table and chat
// membership remain compatibility boundaries for saved composer capabilities.
export const DEFAULT_WORKSPACE_ID = 'howcode:default-workspace'

export const ensureDefaultWorkspace = Effect.fn('Workspace.ensureDefault')(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT OR IGNORE INTO chat_groups (id, name, order_index)
    VALUES (${DEFAULT_WORKSPACE_ID}, 'Personal', -1)`
  return DEFAULT_WORKSPACE_ID
})

export type WorkspaceDirectory = { id: string; name: string; rootId: string }

export const renameWorkspace = Effect.fn('Workspace.rename')(function* (id: string, name: string) {
  const trimmedName = name.trim()
  if (!(id && trimmedName)) return
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      yield* sql`UPDATE chat_groups SET name = ${trimmedName}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`
      yield* sql`UPDATE projects SET custom_name = ${trimmedName}
      WHERE cwd = (SELECT directory_id FROM chat_groups WHERE id = ${id})`
    }),
  )
})

export const moveWorkspaceChat = Effect.fn('Workspace.moveChat')(function* (
  conversationId: string,
  workspaceId: string | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const id = workspaceId ?? (yield* ensureDefaultWorkspace())
      const workspace = yield* sql`SELECT id FROM chat_groups WHERE id = ${id}`
      if (workspace.length === 0) throw new Error('Workspace not found.')
      yield* sql`UPDATE conversation_facts SET workspace_id = ${id} WHERE conversation_id = ${conversationId}`
      // Update legacy group context only for legacy chat-mode conversations.
      // A move must never turn directory/coding conversations into chat-mode ones.
      yield* sql`UPDATE chat_conversations SET group_id = ${id} WHERE conversation_id = ${conversationId}`
    }),
  )
})

export const reconcileWorkspaceOrganization = Effect.fn('Workspace.reconcile')(function* (
  directories: readonly WorkspaceDirectory[],
) {
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const defaultId = yield* ensureDefaultWorkspace()
      // Existing standalone grouping wins over directory attribution. This is
      // idempotent and never reassigns a chat the user has already organized.
      yield* sql`UPDATE conversation_facts SET workspace_id = COALESCE(
      (SELECT group_id FROM chat_conversations WHERE conversation_id = conversation_facts.conversation_id), ${defaultId})
      WHERE workspace_id IS NULL AND EXISTS (
        SELECT 1 FROM chat_conversations WHERE conversation_id = conversation_facts.conversation_id)`
      for (const directory of directories) {
        if (directory.id !== directory.rootId) continue
        const id = `directory:${directory.id}`
        yield* sql`INSERT INTO chat_groups (id, name, directory_id)
        VALUES (${id}, COALESCE((SELECT custom_name FROM projects WHERE cwd = ${directory.id}), ${directory.name}), ${directory.id})
        ON CONFLICT(id) DO UPDATE SET name = excluded.name`
      }
      for (const directory of directories) {
        const id = `directory:${directory.rootId}`
        yield* sql`UPDATE conversation_facts SET workspace_id = ${id}
        WHERE cwd = ${directory.id} AND workspace_id IS NULL
        AND EXISTS (SELECT 1 FROM chat_groups WHERE id = ${id})`
      }
    }),
  )
})
