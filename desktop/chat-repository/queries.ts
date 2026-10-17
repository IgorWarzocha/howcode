import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { sortInboxChatsByPriority } from '../../shared/chat-running-state.ts'
import type {
  DirectoryDiffBaseline,
  DirectoryDiffPreferences,
} from '../../shared/desktop-contracts.ts'
import { applyChatBranchFallbacks } from './chat-branch-fallbacks.ts'
import { mapArchivedChatRow, mapChatRow, mapInboxChatRow } from './mappers.ts'
import {
  ArchivedChatRowSchema,
  ChatRowSchema,
  decodePersistedRows,
  InboxChatRowSchema,
} from './row-schema.ts'
import type { ChatCwdRow, ChatDiffPreferencesRow, ChatPathRow } from './types.ts'

function parseDiffBaseline(value: string | null): DirectoryDiffBaseline | null {
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
  kind: Extract<DirectoryDiffBaseline['kind'], 'branch' | 'parent-branch'>,
  branchName: unknown,
): DirectoryDiffBaseline | null {
  return typeof branchName === 'string' && branchName.trim().length > 0
    ? { kind, branchName }
    : null
}

export const getChatDiffPreferences = Effect.fn('chatRepository.getChatDiffPreferences')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ChatDiffPreferencesRow>(
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

  const preferences: DirectoryDiffPreferences = {
    baseline: parseDiffBaseline(row?.diffBaselineJson ?? null),
    renderMode: renderMode === 'stacked' || renderMode === 'split' ? renderMode : null,
  }
  return preferences
})

export const listDirectoryChats = Effect.fn('chatRepository.listDirectoryChats')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    ChatRowSchema,
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
      [directoryId],
    ),
    'chat',
  )

  const enriched = yield* applyChatBranchFallbacks(rows, () => directoryId)
  return enriched.map(mapChatRow)
})

export const listArchivedDirectoryChats = Effect.fn('chatRepository.listArchivedDirectoryChats')(
  function* (directoryId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      ChatRowSchema,
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
        [directoryId],
      ),
      'archived project thread',
    )

    const enriched = yield* applyChatBranchFallbacks(rows, () => directoryId)
    return enriched.map(mapChatRow)
  },
)

export const listInboxChats = Effect.fn('chatRepository.listInboxChats')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    InboxChatRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS chatId,
          conversation_facts.title AS title,
          conversation_facts.cwd AS directoryId,
          COALESCE(projects.custom_name, projects.name) AS directoryName,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.last_assistant_preview AS lastAssistantPreview,
          conversation_facts.running AS running,
          conversation_inbox.unread AS unread,
          NULLIF(TRIM(conversation_facts.branch_name), '') AS branchName,
          COALESCE(conversation_facts.last_assistant_at_ms, conversation_facts.last_modified_ms) AS lastActivityMs
        FROM conversation_inbox
        INNER JOIN conversation_facts ON conversation_facts.conversation_id = conversation_inbox.conversation_id
        INNER JOIN projects ON projects.cwd = conversation_facts.cwd
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

  const enriched = yield* applyChatBranchFallbacks(rows, (row) => row.directoryId)
  return sortInboxChatsByPriority(enriched.map((row) => mapInboxChatRow(row)))
})

export const listArchivedChats = Effect.fn('chatRepository.listArchivedChats')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = decodePersistedRows(
    ArchivedChatRowSchema,
    yield* sql.unsafe(
      `
        SELECT
          conversation_facts.id AS id,
          conversation_facts.title AS title,
          conversation_facts.conversation_id AS conversationId,
          conversation_facts.cwd AS directoryId,
          COALESCE(projects.custom_name, projects.name) AS directoryName,
          conversation_facts.last_modified_ms AS lastModifiedMs
        FROM conversation_facts
        INNER JOIN projects ON projects.cwd = conversation_facts.cwd
        WHERE conversation_facts.deleted = 0 AND conversation_facts.archived = 1
        ORDER BY conversation_facts.last_modified_ms DESC, conversation_facts.title COLLATE NOCASE ASC
      `,
    ),
    'archived thread',
  )

  return rows.map(mapArchivedChatRow)
})

export const listDirectoryConversationIds = Effect.fn(
  'chatRepository.listDirectoryConversationIds',
)(function* (directoryId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ChatPathRow>(
    `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ?
      `,
    [directoryId],
  )

  return rows.map((row) => row.conversationId)
})

export const listBranchConversationIds = Effect.fn('chatRepository.listBranchConversationIds')(
  function* (directoryId: string, branchName: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<ChatPathRow>(
      `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ? AND branch_name = ?
      `,
      [directoryId, branchName],
    )

    return rows.map((row) => row.conversationId)
  },
)

export const listBranchChatIds = Effect.fn('chatRepository.listBranchChatIds')(function* (
  directoryId: string,
  branchName: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ChatPathRow>(
    `
        SELECT id AS id, conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ? AND branch_name = ?
      `,
    [directoryId, branchName],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const listDirectoryChatIds = Effect.fn('chatRepository.listDirectoryChatIds')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ChatPathRow>(
    `
        SELECT id AS id, conversation_id AS conversationId
        FROM conversation_facts
        WHERE cwd = ?
      `,
    [directoryId],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const getChatConversationId = Effect.fn('chatRepository.getChatConversationId')(function* (
  chatId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ChatPathRow>(
    `
        SELECT conversation_id AS conversationId
        FROM conversation_facts
        WHERE id = ?
      `,
    [chatId],
  ))[0]

  return row?.conversationId ?? null
})

export const getChatCwd = Effect.fn('chatRepository.getChatCwd')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<ChatCwdRow>(
    `
        SELECT cwd
        FROM conversation_facts
        WHERE conversation_id = ?
      `,
    [conversationId],
  ))[0]

  return row?.cwd ?? null
})
