import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'

/** Legacy conversations may keep their branch only in worktree metadata. */
export const codingThreadBranchFallbacks = Effect.fn('CodingState.threadBranchFallbacks')(
  function* (projectIds: readonly string[]) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<{ projectId: string; branchName: string | null }>`
      SELECT cwd AS projectId, branch_name AS branchName
      FROM project_worktrees WHERE is_main = 0 AND ${sql.in('cwd', projectIds)}
    `
    return new Map(rows.map((row) => [row.projectId, row.branchName]))
  },
)
