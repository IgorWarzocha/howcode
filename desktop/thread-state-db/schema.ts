import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { formatGitCommandError, getNonInteractiveGitEnv } from '../project-git/git-runner.ts'

let schemaReady = false

const legacyCheckpointRefPrefix = 'refs/howcode/checkpoints'

type ProjectPathRow = {
  cwd: string
}

function hasColumn(database: Database, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string
  }>

  return columns.some((column) => column.name === columnName)
}

function hasTable(database: Database, tableName: string) {
  const row = database
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `,
    )
    .get(tableName) as { name?: string | undefined } | undefined

  return row?.name === tableName
}

function runGitSync(projectId: string, args: string[], input?: string | undefined) {
  return execFileSync('git', args, {
    cwd: projectId,
    env: getNonInteractiveGitEnv(),
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024 * 4,
    ...(input ? { input } : {}),
  })
}

function isGitRepositorySync(projectId: string) {
  if (!existsSync(projectId)) {
    return false
  }

  try {
    return runGitSync(projectId, ['rev-parse', '--is-inside-work-tree']).trim() === 'true'
  } catch {
    return false
  }
}

function listLegacyCheckpointRefs(database: Database) {
  const rows = database
    .prepare(
      `
        SELECT cwd
        FROM projects
      `,
    )
    .all() as ProjectPathRow[]

  return [...new Set(rows.map((row) => row.cwd.trim()).filter(Boolean))]
}

function purgeLegacyCheckpointRefsForProject(projectId: string) {
  if (!isGitRepositorySync(projectId)) {
    return true
  }

  try {
    const stdout = runGitSync(projectId, [
      'for-each-ref',
      '--format=%(refname)',
      legacyCheckpointRefPrefix,
    ])
    const refs = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (refs.length === 0) {
      return true
    }

    runGitSync(
      projectId,
      ['update-ref', '--stdin'],
      `start\n${refs.map((ref) => `delete ${ref}`).join('\n')}\ncommit\n`,
    )
    return true
  } catch (error) {
    console.warn(
      `Failed to purge legacy checkpoint refs for ${projectId}: ${formatGitCommandError(error)}`,
    )
    return false
  }
}

function purgeLegacyCheckpointRefsMigration(database: Database) {
  if (!hasTable(database, 'thread_turn_diffs')) {
    return
  }

  const didPurgeEveryProject = listLegacyCheckpointRefs(database).every((projectId) =>
    purgeLegacyCheckpointRefsForProject(projectId),
  )

  if (!didPurgeEveryProject) {
    return
  }

  database.exec(`
    DROP INDEX IF EXISTS thread_turn_diffs_by_path_idx;
    DROP TABLE IF EXISTS thread_turn_diffs;
  `)
}

const threadStateSchemaSql = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      cwd TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      custom_name TEXT,
      order_index INTEGER,
      pinned INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      collapsed INTEGER NOT NULL DEFAULT 1,
      repo_origin_url TEXT,
      repo_origin_checked INTEGER NOT NULL DEFAULT 0,
      git_ops_mode TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS threads (
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
    );

    CREATE INDEX IF NOT EXISTS threads_by_cwd_idx ON threads(cwd, pinned DESC, last_modified_ms DESC);
    CREATE INDEX IF NOT EXISTS threads_by_path_idx ON threads(session_path);

    CREATE TABLE IF NOT EXISTS inbox_items (
      session_path TEXT PRIMARY KEY,
      unread INTEGER NOT NULL DEFAULT 1,
      last_user_prompt TEXT,
      last_assistant_message_json TEXT,
      last_assistant_preview TEXT,
      last_assistant_at_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS inbox_items_by_unread_idx ON inbox_items(unread DESC, last_assistant_at_ms DESC);

    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      order_index INTEGER,
      collapsed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      session_path TEXT PRIMARY KEY,
      group_id TEXT,
      order_index INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS chat_groups_order_idx ON chat_groups(order_index, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS chat_threads_group_idx ON chat_threads(group_id, order_index);

    CREATE TABLE IF NOT EXISTS session_native_extensions (
      session_path TEXT PRIMARY KEY,
      enabled_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

`

function ensureThreadStateTables(database: Database) {
  database.exec(threadStateSchemaSql)
}

function addColumnIfMissing(database: Database, tableName: string, columnSql: string) {
  const columnName = columnSql.split(' ', 1)[0] ?? columnSql
  if (!hasColumn(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`)
  }
}

function ensureProjectColumns(database: Database) {
  addColumnIfMissing(database, 'projects', 'custom_name TEXT')
  addColumnIfMissing(database, 'projects', 'order_index INTEGER')
  addColumnIfMissing(database, 'projects', 'hidden INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'projects', 'pinned INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'projects', 'repo_origin_url TEXT')
  addColumnIfMissing(database, 'projects', 'repo_origin_checked INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'projects', 'git_ops_mode TEXT')
}

function ensureThreadColumns(database: Database) {
  addColumnIfMissing(database, 'threads', 'last_assistant_message_json TEXT')
  addColumnIfMissing(database, 'threads', 'last_assistant_preview TEXT')
  addColumnIfMissing(database, 'threads', 'last_assistant_at_ms INTEGER')
  addColumnIfMissing(database, 'threads', 'running INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'threads', 'branch_name TEXT')
  addColumnIfMissing(database, 'threads', 'diff_baseline_json TEXT')
  addColumnIfMissing(database, 'threads', 'diff_render_mode TEXT')
}

function ensureInboxColumns(database: Database) {
  addColumnIfMissing(database, 'inbox_items', 'last_user_prompt TEXT')
}

function resetRunningThreads(database: Database) {
  database.exec(`
    UPDATE threads
    SET running = 0
    WHERE running != 0
  `)
}

function runThreadStateMigrations(database: Database) {
  purgeLegacyCheckpointRefsMigration(database)
  ensureProjectColumns(database)
  ensureThreadColumns(database)
  ensureInboxColumns(database)
  resetRunningThreads(database)
}

export function ensureThreadStateSchema(database: Database) {
  if (schemaReady) return
  ensureThreadStateTables(database)
  runThreadStateMigrations(database)
  schemaReady = true
}
