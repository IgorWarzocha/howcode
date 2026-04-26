import { createHash } from "node:crypto";
import path from "node:path";
import { getThreadStateDatabase } from "./db.cts";
import { ensureProject } from "./project-writes.cts";
import type { SessionSummaryRecord } from "./types.cts";
import { runInTransaction } from "./write-transaction.cts";

type ThreadIdPathRow = {
  id?: string;
  sessionPath: string;
};

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function getDisambiguatedThreadId(session: SessionSummaryRecord) {
  const suffix = createHash("sha1").update(session.sessionPath).digest("hex").slice(0, 8);
  return `${session.id}:${suffix}`;
}

function getSessionThreadId(session: SessionSummaryRecord, duplicateSessionIds: Set<string>) {
  return duplicateSessionIds.has(session.id) ? getDisambiguatedThreadId(session) : session.id;
}

function getDuplicateSessionIds(sessions: SessionSummaryRecord[]) {
  const sessionPathsById = new Map<string, Set<string>>();

  for (const session of sessions) {
    const sessionPaths = sessionPathsById.get(session.id) ?? new Set<string>();
    sessionPaths.add(session.sessionPath);
    sessionPathsById.set(session.id, sessionPaths);
  }

  return new Set(
    [...sessionPathsById.entries()]
      .filter(([, sessionPaths]) => sessionPaths.size > 1)
      .map(([sessionId]) => sessionId),
  );
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
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  );
  ensureProject(cwd);
  runInTransaction(db, () => {
    const duplicateSessionIds = getDuplicateSessionIds(sessions);

    for (const session of sessions) {
      insertProject.run(session.cwd, path.basename(session.cwd) || session.cwd);
      const threadId = getSessionThreadId(session, duplicateSessionIds);

      insertThread.run(
        threadId,
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

  const storedThreadForPath = db
    .prepare(
      `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(session.sessionPath) as ThreadIdPathRow | undefined;
  const storedDuplicateIdRows = db
    .prepare(
      `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE (id = ? OR id LIKE ? ESCAPE '\\')
          AND session_path != ?
      `,
    )
    .all(
      session.id,
      `${escapeLikePattern(session.id)}:%`,
      session.sessionPath,
    ) as ThreadIdPathRow[];

  const threadId =
    storedThreadForPath?.id && storedThreadForPath.id !== session.id
      ? storedThreadForPath.id
      : storedDuplicateIdRows.length > 0
        ? getDisambiguatedThreadId(session)
        : session.id;

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
  ).run(threadId, session.cwd, session.sessionPath, session.title, session.lastModifiedMs);

  return threadId;
}
