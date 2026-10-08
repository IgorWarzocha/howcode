import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { databaseOperation } from '../chat-repository/db.ts'

const getDirectoryGitOpsModeOperation = Effect.fn('DirectoryGitState.getGitOpsModeOverride')(
  function* (directoryId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<{ gitOpsMode?: string | null }>(
      'SELECT git_ops_mode AS gitOpsMode FROM projects WHERE cwd = ?',
      [directoryId],
    )
    const mode = rows[0]?.gitOpsMode
    return mode === 'commit' || mode === 'commit-push' ? mode : null
  },
)

export const getDirectoryGitOpsMode = databaseOperation(getDirectoryGitOpsModeOperation)
