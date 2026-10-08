import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { ensureProject } from '../../../../desktop/thread-state-db/conversation-scopes.ts'
import { decodePersistedRows } from '../../../../desktop/thread-state-db/row-schema.ts'
import type {
  ProjectUsageTotalsRow,
  ThreadPathRow,
} from '../../../../desktop/thread-state-db/types.ts'
import { mapProjectRow, ProjectRowSchema } from './project-row.ts'

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

export const listProjectFamilyConversationIds = Effect.fn(
  'threadStateDb.listProjectFamilyConversationIds',
)(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<ThreadPathRow>(
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
    [projectId, projectId, projectId],
  )

  return rows.map((row) => row.conversationId)
})

export const hasRetainedProjectFamilyConversations = Effect.fn(
  'Workspace.hasRetainedDirectoryChats',
)(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql`SELECT 1 FROM conversation_facts
      WHERE deleted = 0 AND workspace_id IS NOT NULL
        AND workspace_id != ${`directory:${projectId}`}
        AND (cwd = ${projectId} OR cwd IN (
          SELECT cwd FROM project_worktrees WHERE root_cwd = ${projectId} AND is_main = 0
        )) LIMIT 1`
  return rows.length > 0
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
