import type * as SqlClient from 'effect/sql/SqlClient'
import type { DatabaseSchema } from '../../../desktop/chat-repository/schema.ts'

export function codingSchemaStatements(sql: SqlClient.SqlClient) {
  return [
    sql`CREATE TABLE IF NOT EXISTS project_worktree_settings (
    root_cwd TEXT PRIMARY KEY,
    worktree_dir TEXT NOT NULL DEFAULT './.worktrees',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
  );`,
    sql`CREATE TABLE IF NOT EXISTS project_worktrees (
    cwd TEXT PRIMARY KEY,
    root_cwd TEXT NOT NULL,
    branch_name TEXT,
    parent_branch_name TEXT,
    git_common_dir_identity TEXT,
    is_main INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'howcode',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE,
    FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
  );`,
    sql`CREATE INDEX IF NOT EXISTS project_worktrees_by_root_idx ON project_worktrees(root_cwd, is_main DESC, branch_name COLLATE NOCASE);`,
  ]
}

export const codingColumnMigrations = [
  {
    table: 'project_worktrees',
    column: 'completed',
    definition: 'completed INTEGER NOT NULL DEFAULT 0',
  },
  {
    table: 'project_worktrees',
    column: 'parent_branch_name',
    definition: 'parent_branch_name TEXT',
  },
  {
    table: 'project_worktrees',
    column: 'git_common_dir_identity',
    definition: 'git_common_dir_identity TEXT',
  },
] as const

export const codingDatabaseSchema = {
  statements: codingSchemaStatements,
  migrations: codingColumnMigrations,
} satisfies DatabaseSchema
