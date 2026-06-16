import path from 'node:path'
import type {
  ArchivedThread,
  InboxThread,
  Project,
  ProjectDiffBaseline,
  ProjectDiffPreferences,
  Thread,
} from '../../shared/desktop-contracts.ts'
import {
  getEffectiveThreadRunningState,
  sortInboxThreadsByPriority,
} from '../../shared/thread-running-state.ts'
import { getChatSessionDir } from '../chat-session-dir.ts'
import { ensureChatStateSchema, isChatSessionPath } from '../chat-state-db.ts'
import { getLiveThread } from '../runtime/live-thread-store.ts'
import { getThreadStateDatabase } from './db.ts'
import { mapArchivedThreadRow, mapInboxThreadRow, mapProjectRow, mapThreadRow } from './mappers.ts'
import type {
  ArchivedThreadRow,
  InboxPathRow,
  InboxThreadRow,
  ProjectRow,
  ProjectUsageTotalsRow,
  ThreadAssistantSnapshotRow,
  ThreadCwdRow,
  ThreadDeletionSnapshotRow,
  ThreadDiffPreferencesRow,
  ThreadPathRow,
  ThreadRow,
} from './types.ts'
import { ensureProject } from './writes.ts'

function matchesThreadScope(
  row: { branchName?: string | null | undefined; sessionPath: string },
  options: { chat?: boolean | undefined } = {},
) {
  const isChat = isChatSessionPath(row.sessionPath)
  if (options.chat) return isChat && !row.branchName?.trim()
  return !isChat || Boolean(row.branchName?.trim())
}

function getChatSessionLikePattern() {
  return `${getChatSessionDir() + path.sep}%`
}

export function listProjects(cwd: string): Project[] {
  ensureChatStateSchema()
  const db = getThreadStateDatabase()
  ensureProject(cwd)

  const rows = db
    .prepare(
      `
        SELECT
          projects.cwd AS id,
          COALESCE(projects.custom_name, projects.name) AS name,
          projects.pinned AS pinned,
          projects.collapsed AS collapsed,
          projects.repo_origin_url AS repoOriginUrl,
          projects.repo_origin_checked AS repoOriginChecked,
          projects.git_ops_mode AS gitOpsMode,
          project_worktrees.root_cwd AS worktreeRootProjectId,
          project_worktrees.branch_name AS worktreeBranchName,
          project_worktrees.parent_branch_name AS worktreeParentBranchName,
          project_worktrees.is_main AS worktreeIsMain,
          project_worktrees.source AS worktreeSource,
          project_worktrees.completed AS worktreeCompleted,
          project_worktree_settings.worktree_dir AS worktreeDirectory,
          COUNT(threads.id) AS threadCount,
          COALESCE(MAX(threads.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN project_worktrees
          ON project_worktrees.cwd = projects.cwd
        LEFT JOIN project_worktree_settings
          ON project_worktree_settings.root_cwd = COALESCE(project_worktrees.root_cwd, projects.cwd)
        LEFT JOIN threads
          ON threads.cwd = projects.cwd
          AND threads.archived = 0
          AND (
            (
              threads.branch_name IS NOT NULL
              AND TRIM(threads.branch_name) != ''
            )
            OR EXISTS (
              SELECT 1
              FROM project_worktrees AS thread_worktrees
              WHERE thread_worktrees.cwd = threads.cwd
                AND thread_worktrees.is_main = 0
                AND thread_worktrees.branch_name IS NOT NULL
                AND TRIM(thread_worktrees.branch_name) != ''
            )
            OR (
              threads.session_path NOT LIKE ?
              AND NOT EXISTS (
                SELECT 1 FROM chat_threads WHERE chat_threads.session_path = threads.session_path
              )
            )
          )
        WHERE projects.hidden = 0
        GROUP BY
          projects.cwd,
          COALESCE(projects.custom_name, projects.name),
          projects.pinned,
          projects.collapsed,
          projects.repo_origin_url,
          projects.repo_origin_checked,
          projects.git_ops_mode,
          project_worktrees.root_cwd,
          project_worktrees.branch_name,
          project_worktrees.parent_branch_name,
          project_worktrees.is_main,
          project_worktrees.source,
          project_worktrees.completed,
          project_worktree_settings.worktree_dir
        ORDER BY
          projects.pinned DESC,
          latestModifiedMs DESC,
          projects.name COLLATE NOCASE ASC
      `,
    )
    .all(getChatSessionLikePattern()) as ProjectRow[]

  return rows.map(mapProjectRow)
}

export function hasProject(projectId: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT cwd AS id
        FROM projects
        WHERE cwd = ? AND hidden = 0
      `,
    )
    .get(projectId) as { id?: string | undefined } | undefined

  return row?.id === projectId
}

export function hasRunningProjectThread(projectId: string) {
  const db = getThreadStateDatabase()
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
    .all(projectId) as Array<{ sessionPath: string; running: number }>

  return rows.some((row) =>
    getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath)),
  )
}

function parseDiffBaseline(value: string | null): ProjectDiffBaseline | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const baseline = parsed as {
      branchName?: unknown
      kind?: unknown
      rev?: unknown
      capturedAt?: unknown
      sha?: unknown
    }
    switch (baseline.kind) {
      case 'head':
      case 'previous':
      case 'main-branch':
      case 'dev-branch':
        return { kind: baseline.kind }
      case 'parent-branch':
        return parseNamedDiffBaseline('parent-branch', baseline.branchName)
      case 'branch':
        return parseNamedDiffBaseline('branch', baseline.branchName)
      case 'last-opened':
        return typeof baseline.rev === 'string' && baseline.rev.trim().length > 0
          ? {
              kind: 'last-opened',
              rev: baseline.rev,
              ...(baseline.capturedAt === undefined
                ? {}
                : { capturedAt: baseline.capturedAt as string | null }),
            }
          : null
      case 'commit':
        return typeof baseline.sha === 'string' && baseline.sha.trim().length > 0
          ? { kind: 'commit', sha: baseline.sha }
          : null
      default:
        return null
    }
  } catch {
    return null
  }
}

function parseNamedDiffBaseline(
  kind: Extract<ProjectDiffBaseline['kind'], 'branch' | 'parent-branch'>,
  branchName: unknown,
): ProjectDiffBaseline | null {
  return typeof branchName === 'string' && branchName.trim().length > 0
    ? { kind, branchName }
    : null
}

export function getThreadDiffPreferences(sessionPath: string): ProjectDiffPreferences {
  const db = getThreadStateDatabase()
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
    .get(sessionPath) as ThreadDiffPreferencesRow | undefined
  const renderMode = row?.diffRenderMode

  return {
    baseline: parseDiffBaseline(row?.diffBaselineJson ?? null),
    renderMode: renderMode === 'stacked' || renderMode === 'split' ? renderMode : null,
  }
}

export function listProjectThreads(
  projectId: string,
  options: { chat?: boolean | undefined } = {},
): Thread[] {
  const db = getThreadStateDatabase()
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
          COALESCE(NULLIF(TRIM(threads.branch_name), ''), project_worktrees.branch_name) AS branchName,
          threads.last_modified_ms AS lastModifiedMs
        FROM threads
        LEFT JOIN inbox_items ON inbox_items.session_path = threads.session_path
        LEFT JOIN project_worktrees ON project_worktrees.cwd = threads.cwd AND project_worktrees.is_main = 0
        WHERE threads.cwd = ? AND threads.archived = 0
        ORDER BY threads.pinned DESC, threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all(projectId) as ThreadRow[]

  return rows
    .filter((row) => matchesThreadScope(row, options))
    .map((row) =>
      mapThreadRow({
        ...row,
        running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
          ? 1
          : 0,
      }),
    )
}

export function listArchivedProjectThreads(
  projectId: string,
  options: { chat?: boolean | undefined } = {},
): Thread[] {
  const db = getThreadStateDatabase()
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
          COALESCE(NULLIF(TRIM(threads.branch_name), ''), project_worktrees.branch_name) AS branchName,
          threads.last_modified_ms AS lastModifiedMs
        FROM threads
        LEFT JOIN inbox_items ON inbox_items.session_path = threads.session_path
        LEFT JOIN project_worktrees ON project_worktrees.cwd = threads.cwd AND project_worktrees.is_main = 0
        WHERE threads.cwd = ? AND threads.archived = 1
        ORDER BY threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all(projectId) as ThreadRow[]

  return rows
    .filter((row) => matchesThreadScope(row, options))
    .map((row) =>
      mapThreadRow({
        ...row,
        running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
          ? 1
          : 0,
      }),
    )
}

export function listInboxThreads(): InboxThread[] {
  const db = getThreadStateDatabase()
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
          COALESCE(NULLIF(TRIM(threads.branch_name), ''), project_worktrees.branch_name) AS branchName,
          COALESCE(inbox_items.last_assistant_at_ms, threads.last_modified_ms) AS lastActivityMs,
          CASE WHEN chat_threads.session_path IS NULL THEN 0 ELSE 1 END AS isChat
        FROM inbox_items
        INNER JOIN threads ON threads.session_path = inbox_items.session_path
        INNER JOIN projects ON projects.cwd = threads.cwd
        LEFT JOIN project_worktrees ON project_worktrees.cwd = threads.cwd AND project_worktrees.is_main = 0
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
    .all() as InboxThreadRow[]

  return sortInboxThreadsByPriority(
    rows.map((row) =>
      mapInboxThreadRow({
        ...row,
        running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
          ? 1
          : 0,
      }),
    ),
  )
}

export function listArchivedThreads(): ArchivedThread[] {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT
          threads.id AS id,
          threads.title AS title,
          threads.session_path AS sessionPath,
          threads.cwd AS projectId,
          COALESCE(projects.custom_name, projects.name) AS projectName,
          threads.last_modified_ms AS lastModifiedMs,
          CASE WHEN chat_threads.session_path IS NULL THEN 0 ELSE 1 END AS isChat
        FROM threads
        INNER JOIN projects ON projects.cwd = threads.cwd
        LEFT JOIN chat_threads ON chat_threads.session_path = threads.session_path
        WHERE threads.archived = 1
        ORDER BY threads.last_modified_ms DESC, threads.title COLLATE NOCASE ASC
      `,
    )
    .all() as ArchivedThreadRow[]

  return rows.map(mapArchivedThreadRow)
}

export function listProjectSessionPaths(projectId: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE cwd = ?
      `,
    )
    .all(projectId) as ThreadPathRow[]

  return rows.map((row) => row.sessionPath)
}

export function listProjectFamilySessionPaths(projectId: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT threads.session_path AS sessionPath
        FROM threads
        WHERE threads.cwd = ?
          OR threads.cwd IN (
            SELECT cwd
            FROM project_worktrees
            WHERE root_cwd = ? AND is_main = 0
          )
      `,
    )
    .all(projectId, projectId) as ThreadPathRow[]

  return rows.map((row) => row.sessionPath)
}

export function listProjectFamilyProjectIds(projectId: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT cwd AS id
        FROM projects
        WHERE cwd = ?
          OR cwd IN (
            SELECT cwd
            FROM project_worktrees
            WHERE root_cwd = ? AND is_main = 0
          )
      `,
    )
    .all(projectId, projectId) as { id: string }[]

  return rows.map((row) => row.id)
}

export function listBranchSessionPaths(projectId: string, branchName: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE cwd = ? AND branch_name = ?
      `,
    )
    .all(projectId, branchName) as ThreadPathRow[]

  return rows.map((row) => row.sessionPath)
}

export function listBranchThreadIds(projectId: string, branchName: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT id AS id, session_path AS sessionPath
        FROM threads
        WHERE cwd = ? AND branch_name = ?
      `,
    )
    .all(projectId, branchName) as ThreadPathRow[]

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
}

export function listProjectFamilyBranchThreadIds(projectId: string, branchName: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT id AS id, session_path AS sessionPath
        FROM threads
        LEFT JOIN project_worktrees ON project_worktrees.cwd = threads.cwd AND project_worktrees.is_main = 0
        WHERE COALESCE(NULLIF(TRIM(threads.branch_name), ''), project_worktrees.branch_name) = ?
          AND (
            threads.cwd = ?
            OR threads.cwd IN (
              SELECT cwd
              FROM project_worktrees
              WHERE root_cwd = ? AND is_main = 0
            )
          )
      `,
    )
    .all(branchName, projectId, projectId) as ThreadPathRow[]

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
}

export function listProjectThreadIds(projectId: string) {
  const db = getThreadStateDatabase()
  const rows = db
    .prepare(
      `
        SELECT id AS id, session_path AS sessionPath
        FROM threads
        WHERE cwd = ?
      `,
    )
    .all(projectId) as ThreadPathRow[]

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
}

export function getProjectStoredUsageTotals(projectId: string): ProjectUsageTotalsRow | null {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT
          input AS input,
          output AS output,
          cache_read AS cacheRead,
          cache_write AS cacheWrite,
          total_tokens AS totalTokens,
          cost_total AS costTotal,
          assistant_turn_count AS assistantTurnCount,
          session_count AS sessionCount,
          sessions_with_usage_count AS sessionsWithUsageCount
        FROM project_usage_totals
        WHERE cwd = ?
      `,
    )
    .get(projectId) as ProjectUsageTotalsRow | undefined

  return row ?? null
}

export function getThreadSessionPath(threadId: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE id = ?
      `,
    )
    .get(threadId) as ThreadPathRow | undefined

  return row?.sessionPath ?? null
}

export function getThreadDeletionSnapshot(threadId: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT
          cwd AS cwd,
          title AS title,
          session_path AS sessionPath,
          last_modified_ms AS lastModifiedMs
        FROM threads
        WHERE id = ?
      `,
    )
    .get(threadId) as ThreadDeletionSnapshotRow | undefined

  return row ?? null
}

export function getThreadCwd(sessionPath: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT cwd
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as ThreadCwdRow | undefined

  return row?.cwd ?? null
}

export function hasInboxItem(sessionPath: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT session_path AS sessionPath
        FROM inbox_items
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as InboxPathRow | undefined

  return Boolean(row?.sessionPath)
}

export function getThreadAssistantSnapshot(sessionPath: string) {
  const db = getThreadStateDatabase()
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
    .get(sessionPath) as ThreadAssistantSnapshotRow | undefined

  if (!row?.messageJson) {
    return null
  }

  return row
}
