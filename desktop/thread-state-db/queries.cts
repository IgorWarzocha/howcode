import type {
  ArchivedThread,
  Project,
  Thread,
  TurnDiffSummary,
} from "../../shared/desktop-contracts.ts";
import { getThreadStateDatabase } from "./db.cts";
import { mapArchivedThreadRow, mapProjectRow, mapThreadRow, mapTurnDiffRow } from "./mappers.cts";
import type {
  ArchivedThreadRow,
  ProjectRow,
  ThreadCwdRow,
  ThreadPathRow,
  ThreadRow,
  TurnDiffRow,
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
          projects.collapsed,
          projects.repo_origin_url,
          projects.repo_origin_checked
        ORDER BY
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

export function listProjectThreads(projectId: string): Thread[] {
  const db = getThreadStateDatabase();
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

export function listTurnDiffSummaries(sessionPath: string): TurnDiffSummary[] {
  const db = getThreadStateDatabase();
  const rows = db
    .prepare(
      `
        SELECT
          session_path AS sessionPath,
          checkpoint_turn_count AS checkpointTurnCount,
          checkpoint_ref AS checkpointRef,
          status,
          assistant_message_id AS assistantMessageId,
          files_json AS filesJson,
          completed_at AS completedAt
        FROM thread_turn_diffs
        WHERE session_path = ?
        ORDER BY checkpoint_turn_count ASC
      `,
    )
    .all(sessionPath) as TurnDiffRow[];

  return rows.map(mapTurnDiffRow);
}

export function getLatestTurnDiffSummary(sessionPath: string): TurnDiffSummary | null {
  const db = getThreadStateDatabase();
  const row = db
    .prepare(
      `
        SELECT
          session_path AS sessionPath,
          checkpoint_turn_count AS checkpointTurnCount,
          checkpoint_ref AS checkpointRef,
          status,
          assistant_message_id AS assistantMessageId,
          files_json AS filesJson,
          completed_at AS completedAt
        FROM thread_turn_diffs
        WHERE session_path = ?
        ORDER BY checkpoint_turn_count DESC
        LIMIT 1
      `,
    )
    .get(sessionPath) as TurnDiffRow | undefined;

  return row ? mapTurnDiffRow(row) : null;
}
