import { stat } from 'node:fs/promises'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { runProcessProbe } from '../../../node-runtime/process-probe.ts'
import { formatGitCommandError, getNonInteractiveGitEnv } from './directory-git/git-runner.ts'

const legacyCheckpointRefPrefix = 'refs/howcode/checkpoints'
type DirectoryPathRow = { readonly cwd: string }
function hasErrorCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function runMigrationGitProbe(directoryId: string, args: string[], stdin?: string | undefined) {
  return runProcessProbe({
    executable: 'git',
    args,
    cwd: directoryId,
    env: getNonInteractiveGitEnv(),
    ...(stdin === undefined ? {} : { stdin }),
    timeout: 10_000,
    timeoutMessage: `Timed out migrating legacy Git state for ${directoryId}`,
    maxOutputBytes: 1024 * 1024 * 4,
  })
}

const runMigrationGit = Effect.fnUntraced(function* (
  directoryId: string,
  args: string[],
  stdin?: string | undefined,
) {
  const result = yield* runMigrationGitProbe(directoryId, args, stdin)
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      Object.assign(new Error(`Git exited with code ${result.exitCode ?? 'unknown'}.`), result),
    )
  }
  return result.stdout
})

const isGitRepository = Effect.fnUntraced(function* (directoryId: string) {
  const isDirectory = yield* Effect.tryPromise(() => stat(directoryId)).pipe(
    Effect.map((metadata) => metadata.isDirectory()),
    Effect.catch((error) =>
      hasErrorCode(error.cause, 'ENOENT') ? Effect.succeed(false) : Effect.fail(error),
    ),
  )
  if (!isDirectory) return false

  const result = yield* runMigrationGitProbe(directoryId, ['rev-parse', '--is-inside-work-tree'])
  return result.exitCode === 0 && result.stdout.trim() === 'true'
})

const purgeLegacyCheckpointRefsForDirectory = Effect.fnUntraced(function* (directoryId: string) {
  if (!(yield* isGitRepository(directoryId))) {
    return true
  }

  return yield* Effect.gen(function* () {
    const stdout = yield* runMigrationGit(directoryId, [
      'for-each-ref',
      '--format=%(refname)',
      legacyCheckpointRefPrefix,
    ])
    const refs = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (refs.length === 0) {
      return true
    }

    yield* runMigrationGit(
      directoryId,
      ['update-ref', '--stdin'],
      `start\n${refs.map((ref) => `delete ${ref}`).join('\n')}\ncommit\n`,
    )
    return true
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.warn(
          `Failed to purge legacy checkpoint refs for ${directoryId}: ${formatGitCommandError(error)}`,
        )
        return false
      }),
    ),
  )
})

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
