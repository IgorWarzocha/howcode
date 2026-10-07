import { stat } from 'node:fs/promises'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { runProcessProbe } from '../../../node-runtime/process-probe.ts'
import { formatGitCommandError, getNonInteractiveGitEnv } from './project-git/git-runner.ts'

const legacyCheckpointRefPrefix = 'refs/howcode/checkpoints'
type ProjectPathRow = { readonly cwd: string }
function hasErrorCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function runMigrationGitProbe(projectId: string, args: string[], stdin?: string | undefined) {
  return runProcessProbe({
    executable: 'git',
    args,
    cwd: projectId,
    env: getNonInteractiveGitEnv(),
    ...(stdin === undefined ? {} : { stdin }),
    timeout: 10_000,
    timeoutMessage: `Timed out migrating legacy Git state for ${projectId}`,
    maxOutputBytes: 1024 * 1024 * 4,
  })
}

const runMigrationGit = Effect.fnUntraced(function* (
  projectId: string,
  args: string[],
  stdin?: string | undefined,
) {
  const result = yield* runMigrationGitProbe(projectId, args, stdin)
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      Object.assign(new Error(`Git exited with code ${result.exitCode ?? 'unknown'}.`), result),
    )
  }
  return result.stdout
})

const isGitRepository = Effect.fnUntraced(function* (projectId: string) {
  const isDirectory = yield* Effect.tryPromise(() => stat(projectId)).pipe(
    Effect.map((metadata) => metadata.isDirectory()),
    Effect.catch((error) =>
      hasErrorCode(error.cause, 'ENOENT') ? Effect.succeed(false) : Effect.fail(error),
    ),
  )
  if (!isDirectory) return false

  const result = yield* runMigrationGitProbe(projectId, ['rev-parse', '--is-inside-work-tree'])
  return result.exitCode === 0 && result.stdout.trim() === 'true'
})

const purgeLegacyCheckpointRefsForProject = Effect.fnUntraced(function* (projectId: string) {
  if (!(yield* isGitRepository(projectId))) {
    return true
  }

  return yield* Effect.gen(function* () {
    const stdout = yield* runMigrationGit(projectId, [
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
      projectId,
      ['update-ref', '--stdin'],
      `start\n${refs.map((ref) => `delete ${ref}`).join('\n')}\ncommit\n`,
    )
    return true
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.warn(
          `Failed to purge legacy checkpoint refs for ${projectId}: ${formatGitCommandError(error)}`,
        )
        return false
      }),
    ),
  )
})

export const cleanupLegacyCheckpoints = Effect.fn('ThreadStateSchema.cleanupLegacyCheckpoints')(
  function* () {
    const sql = yield* SqlClient.SqlClient
    const table = yield* sql.unsafe<{ readonly name?: string | undefined }>(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`,
      ['thread_turn_diffs'],
    )
    if (table[0]?.name !== 'thread_turn_diffs') {
      return
    }

    const rows = yield* sql.unsafe<ProjectPathRow>('SELECT cwd FROM projects')
    const projectIds = [
      ...new Set(
        rows.flatMap((row) => {
          const cwd = row.cwd.trim()
          return cwd ? [cwd] : []
        }),
      ),
    ]
    const purgeResults = yield* Effect.forEach(projectIds, purgeLegacyCheckpointRefsForProject, {
      concurrency: 2,
    })
    if (!purgeResults.every(Boolean)) {
      return
    }

    yield* sql`DROP INDEX IF EXISTS thread_turn_diffs_by_path_idx`
    yield* sql`DROP TABLE IF EXISTS thread_turn_diffs`
  },
)
