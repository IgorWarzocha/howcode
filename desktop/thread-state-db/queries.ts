import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type { ProjectDiffBaseline, ProjectDiffPreferences } from '../../shared/desktop-contracts.ts'
import { sortInboxThreadsByPriority } from '../../shared/thread-running-state.ts'
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
  ProjectUsageTotalsRow,
  ThreadCwdRow,
  ThreadDiffPreferencesRow,
  ThreadPathRow,
} from './types.ts'

function matchesThreadScope(
  row: { branchName?: string | null | undefined; conversationId: string },
  options: { chat?: boolean | undefined },
  chatIds: Set<string>,
) {
  const isChat = chatIds.has(row.conversationId)
  if (options.chat) return isChat && !row.branchName?.trim()
  return !isChat || Boolean(row.branchName?.trim())
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
          COUNT(conversation_facts.id) AS threadCount,
          COALESCE(MAX(conversation_facts.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN project_worktrees
          ON project_worktrees.cwd = projects.cwd
        LEFT JOIN project_worktree_settings
          ON project_worktree_settings.root_cwd = COALESCE(project_worktrees.root_cwd, projects.cwd)
        LEFT JOIN conversation_facts
          ON conversation_facts.cwd = projects.cwd
          AND conversation_facts.deleted = 0 AND conversation_facts.archived = 0
          AND (
            (
              conversation_facts.branch_name IS NOT NULL
              AND TRIM(conversation_facts.branch_name) != ''
            )
            OR EXISTS (
              SELECT 1
              FROM project_worktrees AS thread_worktrees
              WHERE thread_worktrees.cwd = conversation_facts.cwd
                AND thread_worktrees.is_main = 0
                AND thread_worktrees.branch_name IS NOT NULL
                AND TRIM(thread_worktrees.branch_name) != ''
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM chat_conversations WHERE chat_conversations.conversation_id = conversation_facts.conversation_id
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
      [],
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
    const rows = yield* sql.unsafe<{ conversationId: string; running: number }>(
      `
        SELECT
          conversation_id AS conversationId,
          running AS running
        FROM conversation_facts
        WHERE cwd = ? AND deleted = 0
      `,
      [projectId],
    )

    return rows.some((row) => Boolean(row.running))
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
  function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ThreadDiffPreferencesRow>(
      `
        SELECT
          diff_baseline_json AS diffBaselineJson,
          diff_render_mode AS diffRenderMode
        FROM conversation_facts
        WHERE conversation_id = ?
      `,
      [conversationId],
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
  const chatIds = new Set(
    (yield* sql<{ id: string }>`SELECT conversation_id AS id FROM chat_conversations`).map(
      (row) => row.id,
    ),
  )
  const rows = decodePersistedRows(
    ThreadRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS summary,
          conversation_facts.running AS running,
          COALESCE(conversation_inbox.unread, 0) AS unread,
          conversation_facts.pinned AS pinned,
          COALESCE(NULLIF(TRIM(conversation_facts.branch_name), ''), project_worktrees.branch_name) AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs
        FROM conversation_facts
        LEFT JOIN conversation_inbox ON conversation_inbox.conversation_id = conversation_facts.conversation_id
        LEFT JOIN project_worktrees ON project_worktrees.cwd = conversation_facts.cwd AND project_worktrees.is_main = 0
        WHERE conversation_facts.deleted = 0 AND conversation_facts.cwd = ? AND conversation_facts.archived = 0
        ORDER BY conversation_facts.pinned DESC, conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
      [projectId],
    ),
    'thread',
  )

  return rows.flatMap((row) =>
    matchesThreadScope(row, options, chatIds) ? [mapThreadRow(row)] : [],
  )
})

export const listArchivedProjectThreads = Effect.fn('threadStateDb.listArchivedProjectThreads')(
  function* (projectId: string, options: { chat?: boolean | undefined } = {}) {
    const sql = yield* SqlClient.SqlClient
    const chatIds = new Set(
      (yield* sql<{ id: string }>`SELECT conversation_id AS id FROM chat_conversations`).map(
        (row) => row.id,
      ),
    )
    const rows = decodePersistedRows(
      ThreadRowSchema,
      yield* sql.unsafe(
        `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS summary,
          conversation_facts.running AS running,
          COALESCE(conversation_inbox.unread, 0) AS unread,
          conversation_facts.pinned AS pinned,
          COALESCE(NULLIF(TRIM(conversation_facts.branch_name), ''), project_worktrees.branch_name) AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs
        FROM conversation_facts
        LEFT JOIN conversation_inbox ON conversation_inbox.conversation_id = conversation_facts.conversation_id
        LEFT JOIN project_worktrees ON project_worktrees.cwd = conversation_facts.cwd AND project_worktrees.is_main = 0
        WHERE conversation_facts.deleted = 0 AND conversation_facts.cwd = ? AND conversation_facts.archived = 1
        ORDER BY conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
        [projectId],
      ),
      'archived project thread',
    )

    return rows.flatMap((row) =>
      matchesThreadScope(row, options, chatIds) ? [mapThreadRow(row)] : [],
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
          conversation_facts.id AS threadId,
          conversation_facts.title AS title,
          conversation_facts.cwd AS projectId,
          COALESCE(projects.custom_name, projects.name) AS projectName,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS lastAssistantPreview,
          conversation_facts.running AS running,
          conversation_inbox.unread AS unread,
          COALESCE(NULLIF(TRIM(conversation_facts.branch_name), ''), project_worktrees.branch_name) AS branchName,
          COALESCE(conversation_facts.last_assistant_at_ms, conversation_facts.last_modified_ms) AS lastActivityMs,
          CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
        FROM conversation_inbox
        INNER JOIN conversation_facts ON conversation_facts.conversation_id = conversation_inbox.conversation_id
        INNER JOIN projects ON projects.cwd = conversation_facts.cwd
        LEFT JOIN project_worktrees ON project_worktrees.cwd = conversation_facts.cwd AND project_worktrees.is_main = 0
        LEFT JOIN chat_conversations ON chat_conversations.conversation_id = conversation_facts.conversation_id
        WHERE
          conversation_facts.deleted = 0 AND projects.hidden = 0
          AND conversation_inbox.dismissed = 0 AND conversation_facts.archived = 0
        ORDER BY
          conversation_inbox.unread DESC,
          conversation_facts.running DESC,
          COALESCE(conversation_facts.last_assistant_at_ms, conversation_facts.last_modified_ms) DESC,
          conversation_facts.title COLLATE NOCASE ASC
      `,
    ),
    'inbox thread',
  )

  return sortInboxThreadsByPriority(rows.map((row) => mapInboxThreadRow(row)))
})

export const listArchivedThreads = Effect.fn('threadStateDb.listArchivedThreads')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    ArchivedThreadRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.cwd AS projectId,
          COALESCE(projects.custom_name, projects.name) AS projectName,
          conversation_facts.last_modified_ms AS lastModifiedMs,
          CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
        FROM conversation_facts
        INNER JOIN projects ON projects.cwd = conversation_facts.cwd
        LEFT JOIN chat_conversations ON chat_conversations.conversation_id = conversation_facts.conversation_id
        WHERE conversation_facts.deleted = 0 AND conversation_facts.archived = 1
        ORDER BY conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
    ),
    'archived thread',
  )

  return rows.map(mapArchivedThreadRow)
})

export const listProjectConversationIds = Effect.fn('threadStateDb.listProjectConversationIds')(
  function* (projectId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<ThreadPathRow>(
      `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ?
      `,
      [projectId],
    )

    return rows.map((row) => row.conversationId)
  },
)

export const listProjectFamilyConversationIds = Effect.fn(
  'threadStateDb.listProjectFamilyConversationIds',
)(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT conversation_facts.conversation_id AS conversationId
        FROM conversation_facts
        WHERE conversation_facts.deleted = 0 AND conversation_facts.cwd = ?
          OR conversation_facts.cwd IN (
            SELECT cwd
            FROM project_worktrees
            WHERE root_cwd = ? AND is_main = 0
          )
      `,
    [projectId, projectId],
  )

  return rows.map((row) => row.conversationId)
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

export const listBranchConversationIds = Effect.fn('threadStateDb.listBranchConversationIds')(
  function* (projectId: string, branchName: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<ThreadPathRow>(
      `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ? AND branch_name = ?
      `,
      [projectId, branchName],
    )

    return rows.map((row) => row.conversationId)
  },
)

export const listBranchThreadIds = Effect.fn('threadStateDb.listBranchThreadIds')(function* (
  projectId: string,
  branchName: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
    `
        SELECT id AS id, conversation_id AS conversationId
        FROM conversation_facts
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
        SELECT id AS id, conversation_id AS conversationId
        FROM conversation_facts
        LEFT JOIN project_worktrees ON project_worktrees.cwd = conversation_facts.cwd AND project_worktrees.is_main = 0
        WHERE COALESCE(NULLIF(TRIM(conversation_facts.branch_name), ''), project_worktrees.branch_name) = ?
          AND (
            conversation_facts.cwd = ?
            OR conversation_facts.cwd IN (
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
        SELECT id AS id, conversation_id AS conversationId
        FROM conversation_facts
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

export const getThreadConversationId = Effect.fn('threadStateDb.getThreadConversationId')(
  function* (threadId: string) {
    const sql = yield* SqlClient.SqlClient
    const row = (yield* sql.unsafe<ThreadPathRow>(
      `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE id = ?
      `,
      [threadId],
    ))[0]

    return row?.conversationId ?? null
  },
)

export const getThreadCwd = Effect.fn('threadStateDb.getThreadCwd')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ThreadCwdRow>(
    `
        SELECT cwd
        FROM conversation_facts
        WHERE conversation_id = ?
      `,
    [conversationId],
  ))[0]

  return row?.cwd ?? null
})
