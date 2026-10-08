import type * as SqlClient from 'effect/sql/SqlClient'
import type { DatabaseSchema } from '../../../desktop/chat-repository/schema.ts'

export function artifactsSchemaStatements(sql: SqlClient.SqlClient) {
  return [
    sql`CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
    sql`CREATE TABLE IF NOT EXISTS artifact_versions (
    artifact_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (artifact_id, version),
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
  );`,
    sql`CREATE INDEX IF NOT EXISTS artifacts_conversation_idx ON artifacts(conversation_id, updated_at DESC);`,
  ]
}

export const artifactsDatabaseSchema = {
  statements: artifactsSchemaStatements,
} satisfies DatabaseSchema
