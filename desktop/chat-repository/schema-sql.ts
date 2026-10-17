import type * as SqlClient from 'effect/sql/SqlClient'

export function chatStateSchemaStatements(sql: SqlClient.SqlClient) {
  return [
    sql`PRAGMA journal_mode = WAL;`,
    sql`PRAGMA foreign_keys = ON;`,
    sql`CREATE TABLE IF NOT EXISTS projects (
    cwd TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    custom_name TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    collapsed INTEGER NOT NULL DEFAULT 1,
    repo_origin_url TEXT,
    repo_origin_checked INTEGER NOT NULL DEFAULT 0,
    git_ops_mode TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
    sql`CREATE TABLE IF NOT EXISTS conversation_facts (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    conversation_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    custom_title TEXT,
    projection_entry_id TEXT,
    projection_assistant_id TEXT,
    last_assistant_preview TEXT,
    last_assistant_at_ms INTEGER,
    running INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    branch_name TEXT,
    diff_baseline_json TEXT,
    diff_render_mode TEXT,
    last_modified_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE
  );`,
    sql`CREATE INDEX IF NOT EXISTS conversations_by_cwd_idx ON conversation_facts(cwd, pinned DESC, last_modified_ms DESC);`,
    sql`CREATE TABLE IF NOT EXISTS conversation_inbox (
    conversation_id TEXT PRIMARY KEY,
    unread INTEGER NOT NULL DEFAULT 1,
    dismissed INTEGER NOT NULL DEFAULT 0,
    notification_assistant_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversation_facts(conversation_id) ON DELETE CASCADE
  );`,
    sql`CREATE TABLE IF NOT EXISTS conversation_reply_suppressions (
    conversation_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversation_facts(conversation_id) ON DELETE CASCADE
  );`,
    sql`CREATE TABLE IF NOT EXISTS project_usage_totals (
    cwd TEXT PRIMARY KEY,
    input INTEGER NOT NULL DEFAULT 0,
    output INTEGER NOT NULL DEFAULT 0,
    cache_read INTEGER NOT NULL DEFAULT 0,
    cache_write INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_total REAL NOT NULL DEFAULT 0,
    assistant_turn_count INTEGER NOT NULL DEFAULT 0,
    session_count INTEGER NOT NULL DEFAULT 0,
    sessions_with_usage_count INTEGER NOT NULL DEFAULT 0
  );`,
    sql`CREATE INDEX IF NOT EXISTS conversation_inbox_by_unread_idx ON conversation_inbox(unread DESC);`,
    sql`CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
    sql`CREATE TABLE IF NOT EXISTS chat_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_index INTEGER,
    collapsed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
    sql`CREATE INDEX IF NOT EXISTS chat_groups_order_idx ON chat_groups(order_index, name COLLATE NOCASE);`,
  ]
}

export const columnMigrations = [
  { table: 'conversation_facts', column: 'order_index', definition: 'order_index INTEGER' },
  { table: 'chat_groups', column: 'directory_id', definition: 'directory_id TEXT' },
  { table: 'chat_groups', column: 'layout_default_json', definition: 'layout_default_json TEXT' },
  {
    table: 'conversation_facts',
    column: 'workspace_layout_json',
    definition: 'workspace_layout_json TEXT',
  },
  {
    table: 'conversation_facts',
    column: 'workspace_layout_revision',
    definition: 'workspace_layout_revision INTEGER NOT NULL DEFAULT 0',
  },
  {
    table: 'conversation_facts',
    column: 'workspace_id',
    definition: 'workspace_id TEXT REFERENCES chat_groups(id) ON DELETE SET NULL',
  },
  { table: 'projects', column: 'custom_name', definition: 'custom_name TEXT' },
  { table: 'projects', column: 'hidden', definition: 'hidden INTEGER NOT NULL DEFAULT 0' },
  { table: 'projects', column: 'pinned', definition: 'pinned INTEGER NOT NULL DEFAULT 0' },
  { table: 'projects', column: 'repo_origin_url', definition: 'repo_origin_url TEXT' },
  {
    table: 'projects',
    column: 'repo_origin_checked',
    definition: 'repo_origin_checked INTEGER NOT NULL DEFAULT 0',
  },
  { table: 'projects', column: 'git_ops_mode', definition: 'git_ops_mode TEXT' },
  {
    table: 'conversation_facts',
    column: 'last_assistant_preview',
    definition: 'last_assistant_preview TEXT',
  },
  {
    table: 'conversation_facts',
    column: 'last_assistant_at_ms',
    definition: 'last_assistant_at_ms INTEGER',
  },
  {
    table: 'conversation_facts',
    column: 'running',
    definition: 'running INTEGER NOT NULL DEFAULT 0',
  },
  { table: 'conversation_facts', column: 'branch_name', definition: 'branch_name TEXT' },
  {
    table: 'conversation_facts',
    column: 'diff_baseline_json',
    definition: 'diff_baseline_json TEXT',
  },
  { table: 'conversation_facts', column: 'diff_render_mode', definition: 'diff_render_mode TEXT' },
  {
    table: 'project_usage_totals',
    column: 'sessions_with_usage_count',
    definition: 'sessions_with_usage_count INTEGER NOT NULL DEFAULT 0',
  },
] as const
