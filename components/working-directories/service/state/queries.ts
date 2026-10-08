import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { ensureDirectory } from '../../../../desktop/chat-repository/conversation-scopes.ts'
import { decodePersistedRows } from '../../../../desktop/chat-repository/row-schema.ts'
import type {
  ChatPathRow,
  DirectoryUsageTotalsRow,
} from '../../../../desktop/chat-repository/types.ts'
import { DirectoryRowSchema, mapDirectoryRow } from './directory-row.ts'

export const listDirectories = Effect.fn('chatRepository.listDirectories')(function* (cwd: string) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureDirectory(cwd)

  const rows = decodePersistedRows(
    DirectoryRowSchema,
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
          project_worktrees.root_cwd AS worktreeRootDirectoryId,
          project_worktrees.branch_name AS worktreeBranchName,
          project_worktrees.parent_branch_name AS worktreeParentBranchName,
          project_worktrees.is_main AS worktreeIsMain,
          project_worktrees.source AS worktreeSource,
          project_worktrees.completed AS worktreeCompleted,
          project_worktree_settings.worktree_dir AS worktreeDirectory,
          COUNT(conversation_facts.id) AS chatCount,
          COALESCE(MAX(conversation_facts.last_modified_ms), 0) AS latestModifiedMs
        FROM projects
        LEFT JOIN project_worktrees
          ON project_worktrees.cwd = projects.cwd
        LEFT JOIN project_worktree_settings
          ON project_worktree_settings.root_cwd = COALESCE(project_worktrees.root_cwd, projects.cwd)
        LEFT JOIN conversation_facts
          ON conversation_facts.cwd = projects.cwd
          AND conversation_facts.deleted = 0 AND conversation_facts.archived = 0
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
    'directory',
  )

  return rows.map(mapDirectoryRow)
})

export const hasDirectory = Effect.fn('chatRepository.hasDirectory')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<{ id?: string | undefined }>(
    `
        SELECT cwd AS id
        FROM projects
        WHERE cwd = ? AND hidden = 0
      `,
    [directoryId],
  ))[0]

  return row?.id === directoryId
})

export const hasRunningDirectoryChat = Effect.fn('chatRepository.hasRunningDirectoryChat')(
  function* (directoryId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<{ conversationId: string; running: number }>(
      `
        SELECT
          conversation_id AS conversationId,
          running AS running
        FROM conversation_facts
        WHERE cwd = ? AND deleted = 0
      `,
      [directoryId],
    )

    return rows.some((row) => Boolean(row.running))
  },
)

export const listDirectoryFamilyConversationIds = Effect.fn(
  'chatRepository.listDirectoryFamilyConversationIds',
)(function* (directoryId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ChatPathRow>(
    `
        SELECT conversation_facts.conversation_id AS conversationId
        FROM conversation_facts
        WHERE conversation_facts.deleted = 0 AND (
          conversation_facts.workspace_id = 'directory:' || ?
          OR (conversation_facts.workspace_id IS NULL AND (conversation_facts.cwd = ?
          OR conversation_facts.cwd IN (
            SELECT cwd
            FROM project_worktrees
            WHERE root_cwd = ? AND is_main = 0
          ))))
      `,
    [directoryId, directoryId, directoryId],
  )

  return rows.map((row) => row.conversationId)
})

export const hasRetainedDirectoryFamilyConversations = Effect.fn(
  'Workspace.hasRetainedDirectoryChats',
)(function* (directoryId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql`SELECT 1 FROM conversation_facts
      WHERE deleted = 0 AND workspace_id IS NOT NULL
        AND workspace_id != ${`directory:${directoryId}`}
        AND (cwd = ${directoryId} OR cwd IN (
          SELECT cwd FROM project_worktrees WHERE root_cwd = ${directoryId} AND is_main = 0
        )) LIMIT 1`
  return rows.length > 0
})

export const listDirectoryFamilyDirectoryIds = Effect.fn(
  'chatRepository.listDirectoryFamilyDirectoryIds',
)(function* (directoryId: string) {
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
    [directoryId, directoryId],
  )

  return rows.map((row) => row.id)
})

export const listDirectoryFamilyBranchChatIds = Effect.fn(
  'chatRepository.listDirectoryFamilyBranchChatIds',
)(function* (directoryId: string, branchName: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ChatPathRow>(
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
    [branchName, directoryId, directoryId],
  )

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')
})

export const getDirectoryStoredUsageTotals = Effect.fn(
  'chatRepository.getDirectoryStoredUsageTotals',
)(function* (directoryId: string) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<DirectoryUsageTotalsRow>(
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
    [directoryId],
  ))[0]

  return row ?? null
})
