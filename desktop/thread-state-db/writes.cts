import path from "node:path";
import { getThreadStateDatabase } from "./db.cts";
import type { SessionSummaryRecord, TurnDiffSummaryRecord } from "./types.cts";

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

export function setProjectRepoOrigin(projectId: string, originUrl: string | null) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET repo_origin_url = ?, repo_origin_checked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(originUrl, projectId);
}

export function reorderProjects(projectIds: string[]) {
  if (projectIds.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const updateProjectOrder = db.prepare(
    `
      UPDATE projects
      SET order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  );

  db.exec("BEGIN");

  try {
    projectIds.forEach((projectId, index) => {
      updateProjectOrder.run(index, projectId);
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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
  const row = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE id = ?
      `,
    )
    .get(threadId) as { sessionPath?: string } | undefined;

  if (row?.sessionPath) {
    db.prepare(
      `
        DELETE FROM thread_turn_diffs
        WHERE session_path = ?
      `,
    ).run(row.sessionPath);
  }

  db.prepare(
    `
      DELETE FROM threads
      WHERE id = ?
    `,
  ).run(threadId);
}

export function upsertTurnDiffSummary(summary: TurnDiffSummaryRecord) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      INSERT INTO thread_turn_diffs (
        session_path,
        checkpoint_turn_count,
        checkpoint_ref,
        status,
        assistant_message_id,
        files_json,
        completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_path, checkpoint_turn_count) DO UPDATE SET
        checkpoint_ref = excluded.checkpoint_ref,
        status = excluded.status,
        assistant_message_id = excluded.assistant_message_id,
        files_json = excluded.files_json,
        completed_at = excluded.completed_at
    `,
  ).run(
    summary.sessionPath,
    summary.checkpointTurnCount,
    summary.checkpointRef,
    summary.status,
    summary.assistantMessageId ?? null,
    JSON.stringify(summary.files),
    summary.completedAt,
  );
}
