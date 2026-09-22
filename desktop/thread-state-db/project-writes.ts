import path from 'node:path'
import { Effect } from 'effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'

export const ensureProject = Effect.fn('threadStateDb.ensureProject')(function* (cwd: string) {
  const sql = yield* SqlClient.SqlClient
  const projectName = path.basename(cwd) || cwd

  yield* sql.unsafe(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        hidden = 0,
        updated_at = CURRENT_TIMESTAMP
    `,
    [cwd, projectName],
  )
})

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
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
        AND archived = 0
        AND NOT EXISTS (
          SELECT 1 FROM chat_threads WHERE chat_threads.session_path = threads.session_path
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

export const deleteProject = Effect.fn('threadStateDb.deleteProject')(function* (
  projectId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      DELETE FROM project_usage_totals
      WHERE cwd = ?
    `,
    [projectId],
  )
  yield* sql.unsafe(
    `
      DELETE FROM projects
      WHERE cwd = ?
    `,
    [projectId],
  )
})
