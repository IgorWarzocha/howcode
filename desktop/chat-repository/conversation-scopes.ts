import path from 'node:path'
import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'

export const ensureDirectory = Effect.fn('chatRepository.ensureDirectory')(function* (cwd: string) {
  const sql = yield* SqlClient.SqlClient
  const directoryName = path.basename(cwd) || cwd

  yield* sql.unsafe(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        hidden = 0,
        updated_at = CURRENT_TIMESTAMP
    `,
    [cwd, directoryName],
  )
})
