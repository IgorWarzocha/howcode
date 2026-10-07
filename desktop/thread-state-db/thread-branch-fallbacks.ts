import * as Effect from 'effect/Effect'
import type * as SqlClient from 'effect/sql/SqlClient'

type BranchLookup = (
  projectIds: readonly string[],
) => Effect.Effect<ReadonlyMap<string, string | null>, unknown, SqlClient.SqlClient>

let branchLookup: BranchLookup | undefined

export function registerThreadBranchFallbacks(lookup: BranchLookup) {
  if (branchLookup) throw new Error('Thread branch fallbacks are already composed.')
  branchLookup = lookup
  return () => {
    if (branchLookup === lookup) branchLookup = undefined
  }
}

export function applyThreadBranchFallbacks<Row extends { branchName: string | null }>(
  rows: Row[],
  projectId: (row: Row) => string,
) {
  const lookup = branchLookup
  if (!lookup) return Effect.succeed(rows)
  return Effect.gen(function* () {
    const projectIds = [...new Set(rows.filter((row) => row.branchName === null).map(projectId))]
    if (projectIds.length === 0) return rows
    const branches = yield* lookup(projectIds)
    return rows.map((row) =>
      row.branchName === null ? { ...row, branchName: branches.get(projectId(row)) ?? null } : row,
    )
  })
}
