import path from 'node:path'
import { Effect } from 'effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { ProjectDiffBaseline, ProjectDiffPreferences } from '../../shared/desktop-contracts.ts'
import {
  getEffectiveThreadRunningState,
  sortInboxThreadsByPriority,
} from '../../shared/thread-running-state.ts'
import { getChatSessionDir } from '../chat-session-dir.ts'
import { isChatSessionPath } from '../chat-state-db.ts'
import { getLiveThread } from '../runtime/live-thread-store.ts'
import { mapArchivedThreadRow, mapInboxThreadRow, mapProjectRow, mapThreadRow } from './mappers.ts'
import { ensureProject } from './project-writes.ts'
import {
  ArchivedThreadRowSchema,
  decodePersistedRows,
  InboxThreadRowSchema,
  ProjectRowSchema,
  ThreadRowSchema,
} from './row-schema.ts'
import type {
  InboxPathRow,
  ProjectUsageTotalsRow,
  ThreadAssistantSnapshotRow,
  ThreadCwdRow,
  ThreadDeletionSnapshotRow,
  ThreadDiffPreferencesRow,
  ThreadPathRow,
} from './types.ts'

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

export const listProjects = Effect.fn('threadStateDb.listProjects')(function* (cwd: string) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureProject(cwd)

  const rows = decodePersistedRows(
    ProjectRowSchema,
    yield* sql.unsafe(
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
      [getChatSessionLikePattern()],
    ),
    'project',
  )

  return rows.map(mapProjectRow)
})

export const hasProject = Effect.fn('threadStateDb.hasProject')(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<{ id?: string | undefined }>(
    `
        SELECT cwd AS id
        FROM projects
        WHERE cwd = ? AND hidden = 0
      `,
    [projectId],
  ))[0]

  return row?.id === projectId
})

export const hasRunningProjectThread = Effect.fn('threadStateDb.hasRunningProjectThread')(
  function* (projectId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<{ sessionPath: string; running: number }>(
      `
        SELECT
          session_path AS sessionPath,
          running AS running
        FROM threads
        WHERE cwd = ?
      `,
      [projectId],
    )

    return rows.some((row) =>
      getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath)),
    )
  },
)

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

export const getThreadDiffPreferences = Effect.fn('threadStateDb.getThreadDiffPreferences')(
  function* (sessionPath: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ThreadDiffPreferencesRow>(
      `
        SELECT
          diff_baseline_json AS diffBaselineJson,
          diff_render_mode AS diffRenderMode
        FROM threads
        WHERE session_path = ?
      `,
      [sessionPath],
    ))[0]
    const renderMode = row?.diffRenderMode

    const preferences: ProjectDiffPreferences = {
      baseline: parseDiffBaseline(row?.diffBaselineJson ?? null),
      renderMode: renderMode === 'stacked' || renderMode === 'split' ? renderMode : null,
    }
    return preferences
  },
)

export const listProjectThreads = Effect.fn('threadStateDb.listProjectThreads')(function* (
  projectId: string,
  options: { chat?: boolean | undefined } = {},
) {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    ThreadRowSchema,
    yield* sql.unsafe(
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
      [projectId],
    ),
    'thread',
  )

  return rows.flatMap((row) =>
    matchesThreadScope(row, options)
      ? [
          mapThreadRow({
            ...row,
            running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
              ? 1
              : 0,
          }),
        ]
      : [],
  )
})

export const listArchivedProjectThreads = Effect.fn('threadStateDb.listArchivedProjectThreads')(
  function* (projectId: string, options: { chat?: boolean | undefined } = {}) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      ThreadRowSchema,
      yield* sql.unsafe(
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
        [projectId],
      ),
      'archived project thread',
    )

    return rows.flatMap((row) =>
      matchesThreadScope(row, options)
        ? [
            mapThreadRow({
              ...row,
              running: getEffectiveThreadRunningState(row.running, getLiveThread(row.sessionPath))
                ? 1
                : 0,
            }),
          ]
        : [],
    )
  },
)

export const listInboxThreads = Effect.fn('threadStateDb.listInboxThreads')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    InboxThreadRowSchema,
    yield* sql.unsafe(
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
    ),
    'inbox thread',
  )

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
})

export const listArchivedThreads = Effect.fn('threadStateDb.listArchivedThreads')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    ArchivedThreadRowSchema,
    yield* sql.unsafe(
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
    ),
    'archived thread',
  )

  return rows.map(mapArchivedThreadRow)
})

export const listProjectSessionPaths = Effect.fn('threadStateDb.listProjectSessionPaths')(
  function* (projectId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<ThreadPathRow>(
      `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE cwd = ?
      `,
      [projectId],
    )

    return rows.map((row) => row.sessionPath)
  },
)

export const listProjectFamilySessionPaths = Effect.fn(
  'threadStateDb.listProjectFamilySessionPaths',
)(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
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
    [projectId, projectId],
  )

  return rows.map((row) => row.sessionPath)
})

export const listProjectFamilyProjectIds = Effect.fn('threadStateDb.listProjectFamilyProjectIds')(
  function* (projectId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<{ id: string }>(
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
      [projectId, projectId],
    )

    return rows.map((row) => row.id)
  },
)

export const listBranchSessionPaths = Effect.fn('threadStateDb.listBranchSessionPaths')(function* (
  projectId: string,
  branchName: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE cwd = ? AND branch_name = ?
      `,
    [projectId, branchName],
  )

  return rows.map((row) => row.sessionPath)
})

export const listBranchThreadIds = Effect.fn('threadStateDb.listBranchThreadIds')(function* (
  projectId: string,
  branchName: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT id AS id, session_path AS sessionPath
        FROM threads
        WHERE cwd = ? AND branch_name = ?
      `,
    [projectId, branchName],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const listProjectFamilyBranchThreadIds = Effect.fn(
  'threadStateDb.listProjectFamilyBranchThreadIds',
)(function* (projectId: string, branchName: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
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
    [branchName, projectId, projectId],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const listProjectThreadIds = Effect.fn('threadStateDb.listProjectThreadIds')(function* (
  projectId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT id AS id, session_path AS sessionPath
        FROM threads
        WHERE cwd = ?
      `,
    [projectId],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const getProjectStoredUsageTotals = Effect.fn('threadStateDb.getProjectStoredUsageTotals')(
  function* (projectId: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ProjectUsageTotalsRow>(
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
      [projectId],
    ))[0]

    return row ?? null
  },
)

export const getThreadSessionPath = Effect.fn('threadStateDb.getThreadSessionPath')(function* (
  threadId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT session_path AS sessionPath
        FROM threads
        WHERE id = ?
      `,
    [threadId],
  ))[0]

  return row?.sessionPath ?? null
})

export const getThreadDeletionSnapshot = Effect.fn('threadStateDb.getThreadDeletionSnapshot')(
  function* (threadId: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ThreadDeletionSnapshotRow>(
      `
        SELECT
          cwd AS cwd,
          title AS title,
          session_path AS sessionPath,
          last_modified_ms AS lastModifiedMs
        FROM threads
        WHERE id = ?
      `,
      [threadId],
    ))[0]

    return row ?? null
  },
)

export const getThreadCwd = Effect.fn('threadStateDb.getThreadCwd')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ThreadCwdRow>(
    `
        SELECT cwd
        FROM threads
        WHERE session_path = ?
      `,
    [sessionPath],
  ))[0]

  return row?.cwd ?? null
})

export const hasInboxItem = Effect.fn('threadStateDb.hasInboxItem')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<InboxPathRow>(
    `
        SELECT session_path AS sessionPath
        FROM inbox_items
        WHERE session_path = ?
      `,
    [sessionPath],
  ))[0]

  return Boolean(row?.sessionPath)
})

export const getThreadAssistantSnapshot = Effect.fn('threadStateDb.getThreadAssistantSnapshot')(
  function* (sessionPath: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ThreadAssistantSnapshotRow>(
      `
        SELECT
          last_assistant_message_json AS messageJson,
          last_assistant_preview AS preview
        FROM threads
        WHERE session_path = ?
      `,
      [sessionPath],
    ))[0]

    if (!row?.messageJson) {
      return null
    }

    return row
  },
)
