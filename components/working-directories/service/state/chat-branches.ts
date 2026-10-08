import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'

/** Legacy conversations may keep their branch only in worktree metadata. */
export const workingDirectoryChatBranchFallbacks = Effect.fn('CodingState.threadBranchFallbacks')(
  function* (directoryIds: readonly string[]) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<{ directoryId: string; branchName: string | null }>`
      SELECT cwd AS directoryId, branch_name AS branchName
      FROM project_worktrees WHERE is_main = 0 AND ${sql.in('cwd', directoryIds)}
    `
    return new Map(rows.map((row) => [row.directoryId, row.branchName]))
  },
)
