import path from "node:path";
import { getChatSessionDir } from "../chat-session-dir.cts";
import type {
  ArchivedThread,
  InboxThread,
  Project,
  Thread,
} from "../../shared/desktop-contracts.ts";
import {
  getEffectiveThreadRunningState,
  sortInboxThreadsByPriority,
} from "../../shared/thread-running-state.ts";
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
  ThreadDiffPreferencesRow,
  ProjectRow,
  ThreadAssistantSnapshotRow,
  ThreadCwdRow,
  ThreadPathRow,
  ThreadRow,
} from "./types.cts";
import type {
  ProjectDiffBaseline,
  ProjectDiffPreferences,
} from "../../shared/desktop-contracts.ts";
import { getLiveThread } from "../runtime/live-thread-store.cts";
import { ensureChatStateSchema, isChatSessionPath } from "../chat-state-db.cts";
import { ensureProject } from "./writes.cts";

function matchesThreadScope(sessionPath: string, options: { chat?: boolean } = {}) {
  return options.chat ? isChatSessionPath(sessionPath) : !isChatSessionPath(sessionPath);
}

function getChatSessionLikePattern() {
  return `${getChatSessionDir() + path.sep}%`;
}

export function listProjects(cwd: string): Project[] {
  ensureChatStateSchema();
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
          projects.git_ops_mode AS gitOpsMode,
          COUNT(threads.id) AS threadCount,
          COALESCE(MAX(threads.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN threads
          ON threads.cwd = projects.cwd
          AND threads.archived = 0
          AND threads.session_path NOT LIKE ?
          AND NOT EXISTS (
            SELECT 1 FROM chat_threads WHERE chat_threads.session_path = threads.session_path
          )
        WHERE projects.hidden = 0
        GROUP BY
          projects.cwd,
          COALESCE(projects.custom_name, projects.name),
          projects.order_index,
          projects.pinned,
          projects.collapsed,
          projects.repo_origin_url,
          projects.repo_origin_checked,
          projects.git_ops_mode
        ORDER BY
          projects.pinned DESC,
          CASE WHEN projects.order_index IS NULL THEN 1 ELSE 0 END,
          projects.order_index ASC,
          CASE WHEN projects.order_index IS NULL AND projects.cwd = ? THEN 0 ELSE 1 END,
          latestModifiedMs DESC,
          projects.name COLLATE NOCASE ASC
      `,
    )
    .all(getChatSessionLikePattern(), cwd) as ProjectRow[];

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
  const rows = db
    .prepare(
      `
        SELECT
          session_path AS sessionPath,
          running AS running
        FROM threads
        WHERE cwd = ?
      `,
    )
    .all(projectId) as Array<{ sessionPath: string; running: number }>;

  return rows.some((row) =>
    getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath)),
  );
}

function parseDiffBaseline(value: string | null): ProjectDiffBaseline | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const baseline = parsed as Record<string, unknown>;
    switch (baseline.kind) {
      case "head":
      case "previous":
      case "yesterday":
      case "main-branch":
      case "dev-branch":
        return { kind: baseline.kind };
      case "last-opened":
        return typeof baseline.rev === "string" && baseline.rev.trim().length > 0
          ? {
              kind: "last-opened",
              rev: baseline.rev,
              capturedAt: baseline.capturedAt as string | null | undefined,
            }
          : null;
      case "commit":
        return typeof baseline.sha === "string" && baseline.sha.trim().length > 0
          ? { kind: "commit", sha: baseline.sha }
          : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function getThreadDiffPreferences(sessionPath: string): ProjectDiffPreferences {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT
          diff_baseline_json AS diffBaselineJson,
          diff_render_mode AS diffRenderMode
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as ThreadDiffPreferencesRow | undefined;
  const renderMode = row?.diffRenderMode;

  return {
    baseline: parseDiffBaseline(row?.diffBaselineJson ?? null),
    renderMode: renderMode === "stacked" || renderMode === "split" ? renderMode : null,
  };
}

export function listProjectThreads(projectId: string, options: { chat?: boolean } = {}): Thread[] {
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

  return rows
    .filter((row) => matchesThreadScope(row.sessionPath, options))
    .map((row) =>
      mapThreadRow({
        ...row,
        running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
          ? 1
          : 0,
      }),
    );
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
          COALESCE(inbox_items.last_assistant_at_ms, threads.last_modified_ms) AS lastActivityMs,
          CASE WHEN chat_threads.session_path IS NULL THEN 0 ELSE 1 END AS isChat
        FROM inbox_items
        INNER JOIN threads ON threads.session_path = inbox_items.session_path
        INNER JOIN projects ON projects.cwd = threads.cwd
        LEFT JOIN chat_threads ON chat_threads.session_path = threads.session_path
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

  return sortInboxThreadsByPriority(
    rows.map((row) =>
      mapInboxThreadRow({
        ...row,
        running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
          ? 1
          : 0,
      }),
    ),
  );
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
        LEFT JOIN chat_threads ON chat_threads.session_path = threads.session_path
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
