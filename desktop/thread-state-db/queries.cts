import type {
  ArchivedThread,
  InboxThread,
  Project,
  Thread,
} from "../../shared/desktop-contracts.ts";
import { getThreadStateDatabase } from "./db.cts";
import {
  mapArchivedThreadRow,
  mapInboxThreadRow,
  mapProjectRow,
  mapThreadRow,
} from "./mappers.cts";
import type {
  ArchivedThreadRow,
  InboxPathRow,
  InboxThreadRow,
  ProjectRow,
  ThreadAssistantSnapshotRow,
  ThreadCwdRow,
  ThreadPathRow,
  ThreadRow,
} from "./types.cts";
import { ensureProject } from "./writes.cts";

export function listProjects(cwd: string): Project[] {
  const db = getThreadStateDatabase();
  ensureProject(cwd);

  const rows = db
    .prepare(
      `
        SELECT
          projects.cwd AS id,
          COALESCE(projects.custom_name, projects.name) AS name,
          projects.order_index AS orderIndex,
          projects.pinned AS pinned,
          projects.collapsed AS collapsed,
          projects.repo_origin_url AS repoOriginUrl,
          projects.repo_origin_checked AS repoOriginChecked,
          COUNT(threads.id) AS threadCount,
          COALESCE(MAX(threads.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN threads ON threads.cwd = projects.cwd AND threads.archived = 0
        WHERE projects.hidden = 0
        GROUP BY
          projects.cwd,
          COALESCE(projects.custom_name, projects.name),
          projects.order_index,
          projects.pinned,
          projects.collapsed,
          projects.repo_origin_url,
          projects.repo_origin_checked
        ORDER BY
          projects.pinned DESC,
          CASE WHEN projects.order_index IS NULL THEN 1 ELSE 0 END,
          projects.order_index ASC,
          CASE WHEN projects.order_index IS NULL AND projects.cwd = ? THEN 0 ELSE 1 END,
          latestModifiedMs DESC,
          projects.name COLLATE NOCASE ASC
      `,
    )
    .all(cwd) as ProjectRow[];

  return rows.map(mapProjectRow);
}

export function hasProject(projectId: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT cwd AS id
        FROM projects
        WHERE cwd = ? AND hidden = 0
      `,
    )
    .get(projectId) as { id?: string } | undefined;

  return row?.id === projectId;
}

export function hasRunningProjectThread(projectId: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT id
        FROM threads
        WHERE cwd = ? AND running = 1
        LIMIT 1
      `,
    )
    .get(projectId) as { id?: string } | undefined;

  return typeof row?.id === "string";
}

export function listProjectThreads(projectId: string): Thread[] {
  const db = getThreadStateDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS id,
          threads.title AS title,
          threads.session_path AS sessionPath,
          COALESCE(inbox_items.last_assistant_preview, threads.last_assistant_preview) AS summary,
          threads.running AS running,
          COALESCE(inbox_items.unread, 0) AS unread,
          threads.pinned AS pinned,
          threads.last_modified_ms AS lastModifiedMs
        FROM threads
        LEFT JOIN inbox_items ON inbox_items.session_path = threads.session_path
        WHERE threads.cwd = ? AND threads.archived = 0
        ORDER BY threads.pinned DESC, threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all(projectId) as ThreadRow[];

  return rows.map(mapThreadRow);
}

export function listInboxThreads(): InboxThread[] {
  const db = getThreadStateDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS threadId,
          threads.title AS title,
          threads.cwd AS projectId,
          COALESCE(projects.custom_name, projects.name) AS projectName,
          threads.session_path AS sessionPath,
          inbox_items.last_user_prompt AS lastUserPrompt,
          inbox_items.last_assistant_message_json AS lastAssistantMessageJson,
          inbox_items.last_assistant_preview AS lastAssistantPreview,
          threads.running AS running,
          inbox_items.unread AS unread,
          COALESCE(inbox_items.last_assistant_at_ms, threads.last_modified_ms) AS lastActivityMs
        FROM inbox_items
        INNER JOIN threads ON threads.session_path = inbox_items.session_path
        INNER JOIN projects ON projects.cwd = threads.cwd
        WHERE
          projects.hidden = 0
          AND threads.archived = 0
        ORDER BY
          inbox_items.unread DESC,
          threads.running DESC,
          COALESCE(inbox_items.last_assistant_at_ms, threads.last_modified_ms) DESC,
          threads.title COLLATE NOCASE ASC
      `,
    )
    .all() as InboxThreadRow[];

  return rows.map(mapInboxThreadRow);
}

export function listArchivedThreads(): ArchivedThread[] {
  const db = getThreadStateDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS id,
          threads.title AS title,
          threads.session_path AS sessionPath,
          threads.cwd AS projectId,
          COALESCE(projects.custom_name, projects.name) AS projectName,
          threads.last_modified_ms AS lastModifiedMs
        FROM threads
        INNER JOIN projects ON projects.cwd = threads.cwd
        WHERE threads.archived = 1
        ORDER BY threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all() as ArchivedThreadRow[];

  return rows.map(mapArchivedThreadRow);
}

export function listProjectSessionPaths(projectId: string) {
  const db = getThreadStateDatabase();
  const rows = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE cwd = ?
      `,
    )
    .all(projectId) as ThreadPathRow[];

  return rows.map((row) => row.sessionPath);
}

export function getThreadSessionPath(threadId: string) {
  const db = getThreadStateDatabase();
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

export function getThreadCwd(sessionPath: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT cwd
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as ThreadCwdRow | undefined;

  return row?.cwd ?? null;
}

export function hasInboxItem(sessionPath: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM inbox_items
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as InboxPathRow | undefined;

  return Boolean(row?.sessionPath);
}

export function getThreadAssistantSnapshot(sessionPath: string) {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT
          last_assistant_message_json AS messageJson,
          last_assistant_preview AS preview
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as ThreadAssistantSnapshotRow | undefined;

  if (!row?.messageJson) {
    return null;
  }

  return row;
}
