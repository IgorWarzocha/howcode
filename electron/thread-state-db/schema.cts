import type { DatabaseSync } from "node:sqlite";

let schemaReady = false;

function hasColumn(database: DatabaseSync, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

export function ensureThreadStateSchema(database: DatabaseSync) {
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
      hidden INTEGER NOT NULL DEFAULT 0,
      collapsed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      cwd TEXT NOT NULL,
      session_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      last_modified_ms INTEGER NOT NULL,
      hydrated_modified_ms INTEGER,
      messages_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS threads_by_cwd_idx ON threads(cwd, pinned DESC, last_modified_ms DESC);
    CREATE INDEX IF NOT EXISTS threads_by_path_idx ON threads(session_path);
  `);

  if (!hasColumn(database, "projects", "custom_name")) {
    database.exec("ALTER TABLE projects ADD COLUMN custom_name TEXT");
  }

  if (!hasColumn(database, "projects", "hidden")) {
    database.exec("ALTER TABLE projects ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  }

  schemaReady = true;
}
