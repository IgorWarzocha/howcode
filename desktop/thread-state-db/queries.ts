import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type { ProjectDiffBaseline, ProjectDiffPreferences } from '../../shared/desktop-contracts.ts'
import { sortInboxThreadsByPriority } from '../../shared/thread-running-state.ts'
import { mapArchivedThreadRow, mapInboxThreadRow, mapThreadRow } from './mappers.ts'
import {
  ArchivedThreadRowSchema,
  decodePersistedRows,
  InboxThreadRowSchema,
  ThreadRowSchema,
} from './row-schema.ts'
import { applyThreadBranchFallbacks } from './thread-branch-fallbacks.ts'
import type { ThreadCwdRow, ThreadDiffPreferencesRow, ThreadPathRow } from './types.ts'

function matchesThreadScope(
  row: { branchName?: string | null | undefined; conversationId: string },
  options: { chat?: boolean | undefined },
  chatIds: Set<string>,
) {
  const isChat = chatIds.has(row.conversationId)
  if (options.chat) return isChat && !row.branchName?.trim()
  return !isChat || Boolean(row.branchName?.trim())
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
          NULLIF(TRIM(conversation_facts.branch_name), '') AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs
        FROM conversation_facts
        LEFT JOIN conversation_inbox ON conversation_inbox.conversation_id = conversation_facts.conversation_id
        WHERE conversation_facts.deleted = 0 AND conversation_facts.cwd = ? AND conversation_facts.archived = 0
        ORDER BY conversation_facts.pinned DESC, conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
      [projectId],
    ),
    'thread',
  )

  const enriched = yield* applyThreadBranchFallbacks(rows, () => projectId)
  return enriched.flatMap((row) =>
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
          NULLIF(TRIM(conversation_facts.branch_name), '') AS branchName,
          conversation_facts.last_modified_ms AS lastModifiedMs
        FROM conversation_facts
        LEFT JOIN conversation_inbox ON conversation_inbox.conversation_id = conversation_facts.conversation_id
        WHERE conversation_facts.deleted = 0 AND conversation_facts.cwd = ? AND conversation_facts.archived = 1
        ORDER BY conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
        [projectId],
      ),
      'archived project thread',
    )

    const enriched = yield* applyThreadBranchFallbacks(rows, () => projectId)
    return enriched.flatMap((row) =>
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
          NULLIF(TRIM(conversation_facts.branch_name), '') AS branchName,
          COALESCE(conversation_facts.last_assistant_at_ms, conversation_facts.last_modified_ms) AS lastActivityMs,
          CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
        FROM conversation_inbox
        INNER JOIN conversation_facts ON conversation_facts.conversation_id = conversation_inbox.conversation_id
        INNER JOIN projects ON projects.cwd = conversation_facts.cwd
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

  const enriched = yield* applyThreadBranchFallbacks(rows, (row) => row.projectId)
  return sortInboxThreadsByPriority(enriched.map((row) => mapInboxThreadRow(row)))
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
