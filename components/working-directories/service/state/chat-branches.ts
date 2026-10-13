import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import { decodePersistedRows } from '../../../../desktop/chat-repository/row-schema.ts'

const BranchFactSchema = Schema.Struct({
  directoryId: Schema.String,
  branchName: Schema.NullOr(Schema.String),
})

/** Read saved attribution for conversations whose branch predates conversation facts. */
export const persistedWorktreeBranchFacts = Effect.fn('FolderState.persistedBranchFacts')(
  function* (directoryIds: readonly string[]) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      BranchFactSchema,
      yield* sql`
        SELECT cwd AS directoryId, branch_name AS branchName
        FROM project_worktrees WHERE is_main = 0 AND ${sql.in('cwd', directoryIds)}
      `,
      'worktree branch attribution',
    )
    return new Map(rows.map((row) => [row.directoryId, row.branchName]))
  },
)
