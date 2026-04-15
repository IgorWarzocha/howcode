import type { Database } from "bun:sqlite";

let schemaReady = false;

function hasColumn(database: Database, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

export function ensureThreadStateSchema(database: Database) {
  if (schemaReady) {
    return;
  }

  database.exec(`
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
      last_modified_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS threads_by_cwd_idx ON threads(cwd, pinned DESC, last_modified_ms DESC);
    CREATE INDEX IF NOT EXISTS threads_by_path_idx ON threads(session_path);

    DROP INDEX IF EXISTS thread_turn_diffs_by_path_idx;
    DROP TABLE IF EXISTS thread_turn_diffs;

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
  `);

  if (!hasColumn(database, "projects", "custom_name")) {
    database.exec("ALTER TABLE projects ADD COLUMN custom_name TEXT");
  }

  if (!hasColumn(database, "projects", "order_index")) {
    database.exec("ALTER TABLE projects ADD COLUMN order_index INTEGER");
  }

  if (!hasColumn(database, "projects", "hidden")) {
    database.exec("ALTER TABLE projects ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn(database, "projects", "pinned")) {
    database.exec("ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn(database, "projects", "repo_origin_url")) {
    database.exec("ALTER TABLE projects ADD COLUMN repo_origin_url TEXT");
  }

  if (!hasColumn(database, "projects", "repo_origin_checked")) {
    database.exec("ALTER TABLE projects ADD COLUMN repo_origin_checked INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn(database, "threads", "last_assistant_message_json")) {
    database.exec("ALTER TABLE threads ADD COLUMN last_assistant_message_json TEXT");
  }

  if (!hasColumn(database, "threads", "last_assistant_preview")) {
    database.exec("ALTER TABLE threads ADD COLUMN last_assistant_preview TEXT");
  }

  if (!hasColumn(database, "threads", "last_assistant_at_ms")) {
    database.exec("ALTER TABLE threads ADD COLUMN last_assistant_at_ms INTEGER");
  }

  if (!hasColumn(database, "threads", "running")) {
    database.exec("ALTER TABLE threads ADD COLUMN running INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn(database, "inbox_items", "last_user_prompt")) {
    database.exec("ALTER TABLE inbox_items ADD COLUMN last_user_prompt TEXT");
  }

  schemaReady = true;
}
