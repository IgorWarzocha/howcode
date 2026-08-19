import { stat } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import * as Effect from 'effect/Effect'
import { runProcessProbe } from '../../node-runtime/process-probe.ts'
import { formatGitCommandError, getNonInteractiveGitEnv } from '../project-git/git-runner.ts'

const readyDatabases = new WeakSet<Database>()
const legacyCheckpointCleanupDatabases = new WeakSet<Database>()

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

function runMigrationGitProbe(projectId: string, args: string[], stdin?: string | undefined) {
  return Effect.runPromise(
    runProcessProbe({
      executable: 'git',
      args,
      cwd: projectId,
      env: getNonInteractiveGitEnv(),
      ...(stdin === undefined ? {} : { stdin }),
      timeout: 10_000,
      timeoutMessage: `Timed out migrating legacy Git state for ${projectId}`,
      maxOutputBytes: 1024 * 1024 * 4,
    }),
  )
}

async function runMigrationGit(projectId: string, args: string[], stdin?: string | undefined) {
  const result = await runMigrationGitProbe(projectId, args, stdin)
  if (result.exitCode !== 0) {
    throw Object.assign(new Error(`Git exited with code ${result.exitCode ?? 'unknown'}.`), result)
  }
  return result.stdout
}

async function isGitRepository(projectId: string) {
  try {
    if (!(await stat(projectId)).isDirectory()) return false
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }

  const result = await runMigrationGitProbe(projectId, ['rev-parse', '--is-inside-work-tree'])
  return result.exitCode === 0 && result.stdout.trim() === 'true'
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

  return [
    ...new Set(
      rows.flatMap((row) => {
        const cwd = row.cwd.trim()
        return cwd ? [cwd] : []
      }),
    ),
  ]
}

async function purgeLegacyCheckpointRefsForProject(projectId: string) {
  if (!(await isGitRepository(projectId))) {
    return true
  }

  try {
    const stdout = await runMigrationGit(projectId, [
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

    await runMigrationGit(
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

async function purgeLegacyCheckpointRefsMigration(database: Database) {
  if (!hasTable(database, 'thread_turn_diffs')) {
    return
  }

  const purgeResults = await Effect.runPromise(
    Effect.forEach(
      listLegacyCheckpointRefs(database),
      (projectId) => Effect.promise(() => purgeLegacyCheckpointRefsForProject(projectId)),
      { concurrency: 2 },
    ),
  )
  const didPurgeEveryProject = purgeResults.every(Boolean)

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

    CREATE TABLE IF NOT EXISTS inbox_reply_suppressions (
      session_path TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_usage_totals (
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

    CREATE TABLE IF NOT EXISTS project_worktree_settings (
      root_cwd TEXT PRIMARY KEY,
      worktree_dir TEXT NOT NULL DEFAULT './.worktrees',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_worktrees (
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
    );

    CREATE INDEX IF NOT EXISTS project_worktrees_by_root_idx ON project_worktrees(root_cwd, is_main DESC, branch_name COLLATE NOCASE);

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

function ensureInboxReplySuppressionTable(database: Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS inbox_reply_suppressions (
      session_path TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
    )
  `)
}

function ensureProjectUsageTotalsColumns(database: Database) {
  addColumnIfMissing(
    database,
    'project_usage_totals',
    'sessions_with_usage_count INTEGER NOT NULL DEFAULT 0',
  )
}

function ensureProjectWorktreeColumns(database: Database) {
  addColumnIfMissing(database, 'project_worktrees', 'completed INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'project_worktrees', 'parent_branch_name TEXT')
}

function resetRunningThreads(database: Database) {
  database.exec(`
    UPDATE threads
    SET running = 0
    WHERE running != 0
  `)
}

function runThreadStateMigrations(database: Database) {
  ensureProjectColumns(database)
  ensureThreadColumns(database)
  ensureInboxColumns(database)
  ensureInboxReplySuppressionTable(database)
  ensureProjectUsageTotalsColumns(database)
  ensureProjectWorktreeColumns(database)
  resetRunningThreads(database)
}

export function ensureThreadStateSchema(database: Database) {
  if (readyDatabases.has(database)) return
  ensureThreadStateTables(database)
  runThreadStateMigrations(database)
  readyDatabases.add(database)
  if (!legacyCheckpointCleanupDatabases.has(database)) {
    legacyCheckpointCleanupDatabases.add(database)
    void purgeLegacyCheckpointRefsMigration(database).catch((error) => {
      console.warn('Failed to complete legacy Git checkpoint cleanup.', error)
    })
  }
}
