import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type { SqlError } from 'effect/sql/SqlError'
import { chatStateSchemaStatements, columnMigrations } from './schema-sql.ts'

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
  for (const contribution of contributions) {
    for (const statement of contribution.statements(sql)) yield* statement
    for (const migration of contribution.migrations ?? []) yield* addColumnIfMissing(sql, migration)
  }

  // No history importer: path-keyed transcript mirrors are retired, not reinterpreted as IDs.
  yield* sql`DROP TABLE IF EXISTS inbox_reply_suppressions`
  yield* sql`DROP TABLE IF EXISTS inbox_items`
  yield* sql`DROP TABLE IF EXISTS chat_threads`
  yield* sql`DROP TABLE IF EXISTS threads`

  yield* sql`UPDATE conversation_facts SET running = 0 WHERE running != 0`
})
