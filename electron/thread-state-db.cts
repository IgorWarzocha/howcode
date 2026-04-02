import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { app } from "electron";
import type { ArchivedThread, Message, Project, Thread } from "../shared/desktop-contracts.js";

type SessionSummaryRecord = {
  id: string;
  cwd: string;
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
};

type ProjectRow = {
  id: string;
  name: string;
  collapsed: number;
  threadCount: number;
  latestModifiedMs: number;
};

type ThreadRow = {
  id: string;
  title: string;
  sessionPath: string;
  pinned: number;
  lastModifiedMs: number;
};

type CachedThreadRow = {
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
  hydratedModifiedMs: number | null;
  messagesJson: string | null;
};

type ArchivedThreadRow = {
  id: string;
  title: string;
  sessionPath: string;
  projectId: string;
  projectName: string;
  lastModifiedMs: number;
};

type ThreadPathRow = {
  sessionPath: string;
};

export type CachedThread = {
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
  hydratedModifiedMs: number | null;
  messages: Message[] | null;
};

let database: DatabaseSync | null = null;

function formatRelativeAge(lastModifiedMs: number) {
  const elapsedMs = Math.max(0, Date.now() - lastModifiedMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < hour) {
    return `${Math.max(1, Math.floor(elapsedMs / minute))}m`;
  }

  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}h`;
  }

  if (elapsedMs < week) {
    return `${Math.floor(elapsedMs / day)}d`;
  }

  if (elapsedMs < month) {
    return `${Math.floor(elapsedMs / week)}w`;
  }

  if (elapsedMs < year) {
    return `${Math.floor(elapsedMs / month)}mo`;
  }

  return `${Math.floor(elapsedMs / year)}y`;
}

function getDatabasePath() {
  const databaseDir = path.join(app.getPath("userData"), "state");
  mkdirSync(databaseDir, { recursive: true });
  return path.join(databaseDir, "desktop.sqlite");
}

function getDatabase() {
  if (database) {
    return database;
  }

  database = new DatabaseSync(getDatabasePath());
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      cwd TEXT PRIMARY KEY,
      name TEXT NOT NULL,
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

  return database;
}

function mapThreadRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    pinned: Boolean(row.pinned),
    sessionPath: row.sessionPath,
  };
}

export function ensureProject(cwd: string) {
  const db = getDatabase();
  const projectName = path.basename(cwd) || cwd;

  db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed)
      VALUES (?, ?, 1)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(cwd, projectName);
}

export function syncSessionSummaries(cwd: string, sessions: SessionSummaryRecord[]) {
  const db = getDatabase();
  const insertProject = db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed)
      VALUES (?, ?, 1)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        updated_at = CURRENT_TIMESTAMP
    `,
  );
  const insertThread = db.prepare(
    `
      INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        id = excluded.id,
        cwd = excluded.cwd,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  );

  ensureProject(cwd);
  db.exec("BEGIN");

  try {
    for (const session of sessions) {
      insertProject.run(session.cwd, path.basename(session.cwd) || session.cwd);
      insertThread.run(
        session.id,
        session.cwd,
        session.sessionPath,
        session.title,
        session.lastModifiedMs,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listProjects(cwd: string): Project[] {
  const db = getDatabase();
  ensureProject(cwd);

  const rows = db
    .prepare(
      `
        SELECT
          projects.cwd AS id,
          projects.name AS name,
          projects.collapsed AS collapsed,
          COUNT(threads.id) AS threadCount,
          COALESCE(MAX(threads.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN threads ON threads.cwd = projects.cwd AND threads.archived = 0
        GROUP BY projects.cwd, projects.name, projects.collapsed
        ORDER BY
          CASE WHEN projects.cwd = ? THEN 0 ELSE 1 END,
          latestModifiedMs DESC,
          projects.name COLLATE NOCASE ASC
      `,
    )
    .all(cwd) as ProjectRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    threads: [],
    threadCount: row.threadCount,
    threadsLoaded: false,
    collapsed: Boolean(row.collapsed),
  }));
}

export function listProjectThreads(projectId: string): Thread[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          id,
          title,
          session_path AS sessionPath,
          pinned,
          last_modified_ms AS lastModifiedMs
        FROM threads
        WHERE cwd = ? AND archived = 0
        ORDER BY pinned DESC, last_modified_ms DESC, title COLLATE NOCASE ASC
      `,
    )
    .all(projectId) as ThreadRow[];

  return rows.map(mapThreadRow);
}

export function getCachedThread(sessionPath: string): CachedThread | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT
          session_path AS sessionPath,
          title,
          last_modified_ms AS lastModifiedMs,
          hydrated_modified_ms AS hydratedModifiedMs,
          messages_json AS messagesJson
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as CachedThreadRow | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionPath: row.sessionPath,
    title: row.title,
    lastModifiedMs: row.lastModifiedMs,
    hydratedModifiedMs: row.hydratedModifiedMs,
    messages: row.messagesJson ? (JSON.parse(row.messagesJson) as Message[]) : null,
  };
}

export function saveThreadCache(
  sessionPath: string,
  title: string,
  messages: Message[],
  hydratedModifiedMs: number,
) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE threads
      SET
        messages_json = ?,
        last_modified_ms = ?,
        hydrated_modified_ms = ?,
        updated_at = CURRENT_TIMESTAMP,
        title = CASE WHEN title = '' THEN ? ELSE title END
      WHERE session_path = ?
    `,
  ).run(JSON.stringify(messages), hydratedModifiedMs, hydratedModifiedMs, title, sessionPath);
}

export function setProjectCollapsed(projectId: string, collapsed: boolean) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(collapsed ? 1 : 0, projectId);
}

export function collapseAllProjects() {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = 1, updated_at = CURRENT_TIMESTAMP
    `,
  ).run();
}

export function toggleThreadPinned(threadId: string) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE threads
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function archiveThread(threadId: string) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function restoreThread(threadId: string) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function listArchivedThreads(): ArchivedThread[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS id,
          threads.title AS title,
          threads.session_path AS sessionPath,
          threads.cwd AS projectId,
          projects.name AS projectName,
          threads.last_modified_ms AS lastModifiedMs
        FROM threads
        INNER JOIN projects ON projects.cwd = threads.cwd
        WHERE threads.archived = 1
        ORDER BY threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all() as ArchivedThreadRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    projectId: row.projectId,
    projectName: row.projectName,
    sessionPath: row.sessionPath,
  }));
}

export function getThreadSessionPath(threadId: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE id = ?
      `,
    )
    .get(threadId) as ThreadPathRow | undefined;

  return row?.sessionPath ?? null;
}

export function deleteThreadRecord(threadId: string) {
  const db = getDatabase();
  db.prepare(
    `
      DELETE FROM threads
      WHERE id = ?
    `,
  ).run(threadId);
}
