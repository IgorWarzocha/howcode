import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type { SqlError } from 'effect/sql/SqlError'
import { DEFAULT_WORKSPACE_ID } from '../../shared/desktop-workspace-contracts.ts'
import { chatStateSchemaStatements, columnMigrations } from './schema-sql.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

type ColumnRow = {
  readonly name: string
}

type ColumnMigration = {
  readonly table: string
  readonly column: string
  readonly definition: string
}

export type DatabaseSchema = {
  readonly statements: (sql: SqlClient.SqlClient) => readonly Effect.Effect<unknown, SqlError>[]
  readonly migrations?: readonly ColumnMigration[]
}

const hasColumn = Effect.fnUntraced(function* (
  sql: SqlClient.SqlClient,
  tableName: string,
  columnName: string,
) {
  const columns = yield* sql<ColumnRow>`PRAGMA table_info(${sql(tableName)})`
  return columns.some((column) => column.name === columnName)
})

const addColumnIfMissing = Effect.fnUntraced(function* (
  sql: SqlClient.SqlClient,
  migration: ColumnMigration,
) {
  if (!(yield* hasColumn(sql, migration.table, migration.column))) {
    // Definitions are static schema fragments, never external input.
    yield* sql`ALTER TABLE ${sql(migration.table)} ADD COLUMN ${sql.literal(migration.definition)}`
  }
})

const migrateUnifiedConversations = Effect.fn('ChatStateSchema.unifyConversations')(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const legacy =
        yield* sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_conversations'`
      if (legacy.length > 0) {
        const orphans = yield* sql`SELECT conversation_id FROM chat_conversations
          WHERE NOT EXISTS (SELECT 1 FROM conversation_facts
            WHERE conversation_facts.conversation_id = chat_conversations.conversation_id)`
        if (orphans.length > 0) {
          throw new Error(
            'Cannot migrate conversation membership: legacy rows have no conversation facts.',
          )
        }
        yield* sql`INSERT OR IGNORE INTO chat_groups (id, name, order_index)
          VALUES (${DEFAULT_WORKSPACE_ID}, 'Chats', -1)`
        // Explicit membership wins. Preserve the old ordering independently of capabilities.
        yield* sql`UPDATE conversation_facts SET
          workspace_id = COALESCE(workspace_id,
            (SELECT group_id FROM chat_conversations WHERE conversation_id = conversation_facts.conversation_id),
            ${DEFAULT_WORKSPACE_ID}),
          order_index = COALESCE(order_index,
            (SELECT order_index FROM chat_conversations WHERE conversation_id = conversation_facts.conversation_id))
          WHERE EXISTS (SELECT 1 FROM chat_conversations
            WHERE conversation_id = conversation_facts.conversation_id)`
        yield* sql`DROP TABLE chat_conversations`
      }

      // Existing unified preferences win. Otherwise newest legacy value wins;
      // equal timestamps choose the chat preference deterministically.
      for (const [target, chat, code] of [
        ['defaultModel', 'chatModel', 'codeModel'],
        ['defaultThinkingLevel', 'chatThinkingLevel', 'codeThinkingLevel'],
      ] as const) {
        yield* sql`INSERT OR IGNORE INTO app_preferences (key, value_json, updated_at)
          SELECT ${target}, value_json, updated_at FROM app_preferences
          WHERE key IN (${chat}, ${code})
          ORDER BY updated_at DESC, CASE WHEN key = ${chat} THEN 0 ELSE 1 END LIMIT 1`
        yield* sql`DELETE FROM app_preferences WHERE key IN (${chat}, ${code})`
      }
    }),
  )
})

export const initializeChatStateSchema = Effect.fn('ChatStateSchema.initialize')(function* (
  contributions: readonly DatabaseSchema[],
) {
  const sql = yield* SqlClient.SqlClient

  for (const statement of chatStateSchemaStatements(sql)) {
    yield* statement
  }
  for (const migration of columnMigrations) {
    yield* addColumnIfMissing(sql, migration)
  }
  yield* migrateUnifiedConversations()
  for (const contribution of contributions) {
    for (const statement of contribution.statements(sql)) yield* statement
    for (const migration of contribution.migrations ?? []) yield* addColumnIfMissing(sql, migration)
  }

  // No history importer: path-keyed transcript mirrors are retired, not reinterpreted as IDs.
  // Combined artifacts are explicitly disposable; independent components own their new stores.
  yield* sql`DROP TABLE IF EXISTS artifact_versions`
  yield* sql`DROP TABLE IF EXISTS artifacts`
  yield* sql`DROP TABLE IF EXISTS inbox_reply_suppressions`
  yield* sql`DROP TABLE IF EXISTS inbox_items`
  yield* sql`DROP TABLE IF EXISTS chat_threads`
  yield* sql`DROP TABLE IF EXISTS threads`

  yield* sql`UPDATE conversation_facts SET running = 0 WHERE running != 0`
})
