import { getThreadStateDatabase } from "./db.cts";
import { runInTransaction } from "./write-transaction.cts";

export function setThreadRunningState(sessionPath: string, running: boolean) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE threads
      SET running = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ? AND running != ?
    `,
  ).run(running ? 1 : 0, sessionPath, running ? 1 : 0);
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

export function archiveThreads(threadIds: string[]) {
  updateArchivedFlag(threadIds, true);
}

export function restoreThreads(threadIds: string[]) {
  updateArchivedFlag(threadIds, false);
}

function updateArchivedFlag(threadIds: string[], archived: boolean) {
  if (threadIds.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const updateThread = db.prepare(
    `
      UPDATE threads
      SET archived = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  );

  runInTransaction(db, () => {
    for (const threadId of threadIds) {
      updateThread.run(archived ? 1 : 0, threadId);
    }
  });
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

export function deleteThreadRecordsBySessionPaths(sessionPaths: string[]) {
  if (sessionPaths.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const deleteThreadBySessionPath = db.prepare(
    `
      DELETE FROM threads
      WHERE session_path = ?
    `,
  );

  runInTransaction(db, () => {
    for (const sessionPath of sessionPaths) {
      deleteThreadBySessionPath.run(sessionPath);
    }
  });
}
