import type * as SqlClient from 'effect/unstable/sql/SqlClient'

export function threadStateSchemaStatements(sql: SqlClient.SqlClient) {
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
    sql`CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    session_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    last_assistant_message_json TEXT,
    last_assistant_preview TEXT,
    last_assistant_at_ms INTEGER,
    running INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    branch_name TEXT,
    diff_baseline_json TEXT,
    diff_render_mode TEXT,
    last_modified_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE
  );`,
    sql`CREATE INDEX IF NOT EXISTS threads_by_cwd_idx ON threads(cwd, pinned DESC, last_modified_ms DESC);`,
    sql`CREATE INDEX IF NOT EXISTS threads_by_path_idx ON threads(session_path);`,
    sql`CREATE TABLE IF NOT EXISTS inbox_items (
    session_path TEXT PRIMARY KEY,
    unread INTEGER NOT NULL DEFAULT 1,
    last_user_prompt TEXT,
    last_assistant_message_json TEXT,
    last_assistant_preview TEXT,
    last_assistant_at_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
  );`,
    sql`CREATE TABLE IF NOT EXISTS inbox_reply_suppressions (
    session_path TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
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
    sql`CREATE INDEX IF NOT EXISTS inbox_items_by_unread_idx ON inbox_items(unread DESC, last_assistant_at_ms DESC);`,
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
    sql`CREATE TABLE IF NOT EXISTS chat_threads (
    session_path TEXT PRIMARY KEY,
    group_id TEXT,
    order_index INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE SET NULL
  );`,
    sql`CREATE INDEX IF NOT EXISTS chat_groups_order_idx ON chat_groups(order_index, name COLLATE NOCASE);`,
    sql`CREATE INDEX IF NOT EXISTS chat_threads_group_idx ON chat_threads(group_id, order_index);`,
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
    is_main INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'howcode',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE,
    FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
  );`,
    sql`CREATE INDEX IF NOT EXISTS project_worktrees_by_root_idx ON project_worktrees(root_cwd, is_main DESC, branch_name COLLATE NOCASE);`,
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

export const columnMigrations = [
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
    table: 'threads',
    column: 'last_assistant_message_json',
    definition: 'last_assistant_message_json TEXT',
  },
  {
    table: 'threads',
    column: 'last_assistant_preview',
    definition: 'last_assistant_preview TEXT',
  },
  {
    table: 'threads',
    column: 'last_assistant_at_ms',
    definition: 'last_assistant_at_ms INTEGER',
  },
  { table: 'threads', column: 'running', definition: 'running INTEGER NOT NULL DEFAULT 0' },
  { table: 'threads', column: 'branch_name', definition: 'branch_name TEXT' },
  { table: 'threads', column: 'diff_baseline_json', definition: 'diff_baseline_json TEXT' },
  { table: 'threads', column: 'diff_render_mode', definition: 'diff_render_mode TEXT' },
  { table: 'inbox_items', column: 'last_user_prompt', definition: 'last_user_prompt TEXT' },
  {
    table: 'project_usage_totals',
    column: 'sessions_with_usage_count',
    definition: 'sessions_with_usage_count INTEGER NOT NULL DEFAULT 0',
  },
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
] as const
