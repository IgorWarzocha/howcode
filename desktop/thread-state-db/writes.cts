import path from "node:path";
import type { Message } from "../../shared/desktop-contracts";
import { getThreadStateDatabase } from "./db";
import type { SessionSummaryRecord } from "./types";

export function ensureProject(cwd: string) {
  const db = getThreadStateDatabase();
  const projectName = path.basename(cwd) || cwd;

  db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        hidden = 0,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(cwd, projectName);
}

export function syncSessionSummaries(cwd: string, sessions: SessionSummaryRecord[]) {
  const db = getThreadStateDatabase();
  const insertProject = db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
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

export function upsertThreadSummary(session: SessionSummaryRecord) {
  const db = getThreadStateDatabase();
  ensureProject(session.cwd);

  db.prepare(
    `
      INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        id = excluded.id,
        cwd = excluded.cwd,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(session.id, session.cwd, session.sessionPath, session.title, session.lastModifiedMs);
}

export function saveThreadCache(
  sessionPath: string,
  title: string,
  messages: Message[],
  hydratedModifiedMs: number,
) {
  const db = getThreadStateDatabase();
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
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(collapsed ? 1 : 0, projectId);
}

export function collapseAllProjects() {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET collapsed = 1, updated_at = CURRENT_TIMESTAMP
    `,
  ).run();
}

export function toggleThreadPinned(threadId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function archiveThread(threadId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function archiveProjectThreads(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ? AND archived = 0
    `,
  ).run(projectId);
}

export function renameProject(projectId: string, projectName: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET custom_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectName, projectId);
}

export function hideProject(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET hidden = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectId);
}

export function restoreThread(threadId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId);
}

export function deleteThreadRecord(threadId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM threads
      WHERE id = ?
    `,
  ).run(threadId);
}
