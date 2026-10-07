import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
export const setProjectCollapsed = Effect.fn('threadStateDb.setProjectCollapsed')(function* (
  projectId: string,
  collapsed: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET collapsed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [collapsed ? 1 : 0, projectId],
  )
})

export const toggleProjectPinned = Effect.fn('threadStateDb.toggleProjectPinned')(function* (
  projectId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [projectId],
  )
})

export const collapseAllProjects = Effect.fn('threadStateDb.collapseAllProjects')(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET collapsed = 1, updated_at = CURRENT_TIMESTAMP
    `,
  )
})

export const archiveProjectThreads = Effect.fn('threadStateDb.archiveProjectThreads')(function* (
  projectId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
        AND archived = 0
        AND NOT EXISTS (
          SELECT 1 FROM chat_conversations WHERE chat_conversations.conversation_id = conversation_facts.conversation_id
        )
    `,
    [projectId],
  )
})

export const renameProject = Effect.fn('threadStateDb.renameProject')(function* (
  projectId: string,
  projectName: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET custom_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [projectName, projectId],
  )
})

export const setProjectRepoOrigin = Effect.fn('threadStateDb.setProjectRepoOrigin')(function* (
  projectId: string,
  originUrl: string | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET repo_origin_url = ?, repo_origin_checked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [originUrl, projectId],
  )
})

export const setProjectGitOpsMode = Effect.fn('threadStateDb.setProjectGitOpsMode')(function* (
  projectId: string,
  mode: 'commit' | 'commit-push' | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET git_ops_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [mode, projectId],
  )
})

export const hideProject = Effect.fn('threadStateDb.hideProject')(function* (projectId: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET hidden = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [projectId],
  )
})

export const deleteProject = Effect.fn('ConversationState.deleteProject')(function* (
  projectId: string,
) {
  const sql = yield* SqlClient.SqlClient
  // Keep attribution and deletion tombstones even after the project leaves the sidebar.
  yield* sql`UPDATE conversation_facts SET deleted = 1, running = 0 WHERE cwd = ${projectId}`
  yield* sql`UPDATE projects SET hidden = 1 WHERE cwd = ${projectId}`
})
