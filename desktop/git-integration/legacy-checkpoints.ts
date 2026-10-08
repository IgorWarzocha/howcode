import { purgeLegacyCheckpointRefsForDirectory } from '@howaboua/howcode-git/service/legacy-checkpoints'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'

type DirectoryPathRow = { readonly cwd: string }

export const cleanupLegacyCheckpoints = Effect.fn('ChatStateSchema.cleanupLegacyCheckpoints')(
  function* () {
    const sql = yield* SqlClient.SqlClient
    const table = yield* sql.unsafe<{ readonly name?: string | undefined }>(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`,
      ['chat_turn_diffs'],
    )
    if (table[0]?.name !== 'chat_turn_diffs') {
      return
    }

    const rows = yield* sql.unsafe<DirectoryPathRow>('SELECT cwd FROM projects')
    const directoryIds = [
      ...new Set(
        rows.flatMap((row) => {
          const cwd = row.cwd.trim()
          return cwd ? [cwd] : []
        }),
      ),
    ]
    const purgeResults = yield* Effect.forEach(
      directoryIds,
      purgeLegacyCheckpointRefsForDirectory,
      {
        concurrency: 2,
      },
    )
    if (!purgeResults.every(Boolean)) {
      return
    }

    yield* sql`DROP INDEX IF EXISTS thread_turn_diffs_by_path_idx`
    yield* sql`DROP TABLE IF EXISTS thread_turn_diffs`
  },
)
