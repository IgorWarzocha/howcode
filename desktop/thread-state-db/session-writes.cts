import path from "node:path";
import { getThreadStateDatabase } from "./db.cts";
import { ensureProject } from "./project-writes.cts";
import type { SessionSummaryRecord } from "./types.cts";
import { runInTransaction } from "./write-transaction.cts";

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
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  );

  ensureProject(cwd);
  runInTransaction(db, () => {
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
  });
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
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(session.id, session.cwd, session.sessionPath, session.title, session.lastModifiedMs);
}
