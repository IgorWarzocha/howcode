import path from "node:path";
import { getThreadStateDatabase } from "./db.cts";
import type { SessionSummaryRecord, ThreadInboxMessageRecord } from "./types.cts";

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
        title = excluded.title,
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
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(session.id, session.cwd, session.sessionPath, session.title, session.lastModifiedMs);
}

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

export function upsertInboxThreadPrompt(sessionPath: string, prompt: string | null) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      INSERT INTO inbox_items (session_path, unread, last_user_prompt)
      VALUES (?, 0, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        last_user_prompt = excluded.last_user_prompt,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(sessionPath, prompt);
}

export function beginInboxThreadTurn(sessionPath: string, prompt: string | null) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      INSERT INTO inbox_items (
        session_path,
        unread,
        last_user_prompt,
        last_assistant_message_json,
        last_assistant_preview,
        last_assistant_at_ms
      )
      VALUES (?, 0, ?, NULL, NULL, NULL)
      ON CONFLICT(session_path) DO UPDATE SET
        unread = 0,
        last_user_prompt = excluded.last_user_prompt,
        last_assistant_message_json = NULL,
        last_assistant_preview = NULL,
        last_assistant_at_ms = NULL,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(sessionPath, prompt);
}

export function markInboxThreadRead(sessionPath: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE inbox_items
      SET unread = 0, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
  ).run(sessionPath);
}

export function dismissInboxThread(sessionPath: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM inbox_items
      WHERE session_path = ?
    `,
  ).run(sessionPath);
}

export function upsertInboxThreadMessage(record: ThreadInboxMessageRecord) {
  const db = getThreadStateDatabase();
  const serializedContent = JSON.stringify(record.content);

  db.prepare(
    `
      INSERT INTO inbox_items (
        session_path,
        unread,
        last_user_prompt,
        last_assistant_message_json,
        last_assistant_preview,
        last_assistant_at_ms
      )
      VALUES (?, 1, ?, ?, ?, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        unread = 1,
        last_user_prompt = excluded.last_user_prompt,
        last_assistant_message_json = excluded.last_assistant_message_json,
        last_assistant_preview = excluded.last_assistant_preview,
        last_assistant_at_ms = excluded.last_assistant_at_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(
    record.sessionPath,
    record.userPrompt,
    serializedContent,
    record.preview,
    record.lastAssistantAtMs,
  );

  db.prepare(
    `
      UPDATE threads
      SET
        last_assistant_message_json = ?,
        last_assistant_preview = ?,
        last_assistant_at_ms = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
  ).run(serializedContent, record.preview, record.lastAssistantAtMs, record.sessionPath);
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

export function toggleProjectPinned(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      UPDATE projects
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(projectId);
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

export function archiveThreads(threadIds: string[]) {
  if (threadIds.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const archiveThreadStatement = db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  );

  db.exec("BEGIN");

  try {
    for (const threadId of threadIds) {
      archiveThreadStatement.run(threadId);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function restoreThreads(threadIds: string[]) {
  if (threadIds.length === 0) {
    return;
  }

  const db = getThreadStateDatabase();
  const restoreThreadStatement = db.prepare(
    `
      UPDATE threads
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  );

  db.exec("BEGIN");

  try {
    for (const threadId of threadIds) {
      restoreThreadStatement.run(threadId);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

export function moveProjectToTop(projectId: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT MIN(order_index) AS minOrderIndex
        FROM projects
        WHERE hidden = 0 AND order_index IS NOT NULL
      `,
    )
    .get() as { minOrderIndex?: number | null } | undefined;

  const nextOrderIndex = typeof row?.minOrderIndex === "number" ? row.minOrderIndex - 1 : 0;

  db.prepare(
    `
      UPDATE projects
      SET order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
  ).run(nextOrderIndex, projectId);
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

export function deleteProject(projectId: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM projects
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

  db.exec("BEGIN");

  try {
    for (const sessionPath of sessionPaths) {
      deleteThreadBySessionPath.run(sessionPath);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
