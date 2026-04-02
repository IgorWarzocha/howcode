import type { ArchivedThread, Project, Thread } from "../../shared/desktop-contracts";
import { getThreadStateDatabase } from "./db";
import { mapArchivedThreadRow, mapCachedThreadRow, mapProjectRow, mapThreadRow } from "./mappers";
import type {
  ArchivedThreadRow,
  CachedThread,
  CachedThreadRow,
  ProjectRow,
  ThreadPathRow,
  ThreadRow,
} from "./types";
import { ensureProject } from "./writes";

export function listProjects(cwd: string): Project[] {
  const db = getThreadStateDatabase();
  ensureProject(cwd);

  const rows = db
    .prepare(
      `
        SELECT
          projects.cwd AS id,
          COALESCE(projects.custom_name, projects.name) AS name,
          projects.collapsed AS collapsed,
          COUNT(threads.id) AS threadCount,
          COALESCE(MAX(threads.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN threads ON threads.cwd = projects.cwd AND threads.archived = 0
        WHERE projects.hidden = 0
        GROUP BY projects.cwd, COALESCE(projects.custom_name, projects.name), projects.collapsed
        ORDER BY
          CASE WHEN projects.cwd = ? THEN 0 ELSE 1 END,
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

export function getCachedThread(sessionPath: string): CachedThread | null {
  const db = getThreadStateDatabase();
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

  return row ? mapCachedThreadRow(row) : null;
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
