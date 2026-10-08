import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
export const setDirectoryCollapsed = Effect.fn('chatRepository.setDirectoryCollapsed')(function* (
  directoryId: string,
  collapsed: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET collapsed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [collapsed ? 1 : 0, directoryId],
  )
})

export const toggleDirectoryPinned = Effect.fn('chatRepository.toggleDirectoryPinned')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [directoryId],
  )
})

export const collapseAllDirectories = Effect.fn('chatRepository.collapseAllDirectories')(
  function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql.unsafe(
      `
      UPDATE projects
      SET collapsed = 1, updated_at = CURRENT_TIMESTAMP
    `,
    )
  },
)

export const archiveDirectoryChats = Effect.fn('chatRepository.archiveDirectoryChats')(function* (
  directoryId: string,
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
    [directoryId],
  )
})

export const renameDirectory = Effect.fn('chatRepository.renameDirectory')(function* (
  directoryId: string,
  directoryName: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET custom_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [directoryName, directoryId],
  )
})

export const setDirectoryRepoOrigin = Effect.fn('chatRepository.setDirectoryRepoOrigin')(function* (
  directoryId: string,
  originUrl: string | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET repo_origin_url = ?, repo_origin_checked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [originUrl, directoryId],
  )
})

export const setDirectoryGitOpsMode = Effect.fn('chatRepository.setDirectoryGitOpsMode')(function* (
  directoryId: string,
  mode: 'commit' | 'commit-push' | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET git_ops_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [mode, directoryId],
  )
})

export const hideDirectory = Effect.fn('chatRepository.hideDirectory')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE projects
      SET hidden = 1, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ?
    `,
    [directoryId],
  )
})

export const deleteDirectory = Effect.fn('ConversationState.deleteDirectory')(function* (
  directoryId: string,
) {
  const sql = yield* SqlClient.SqlClient
  // Keep attribution and deletion tombstones even after the directory leaves the sidebar.
  yield* sql`UPDATE conversation_facts SET deleted = 1, running = 0
    WHERE workspace_id = ${`directory:${directoryId}`}
      OR (workspace_id IS NULL AND cwd = ${directoryId})`
  yield* sql`UPDATE projects SET hidden = 1 WHERE cwd = ${directoryId}`
})
