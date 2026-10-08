import * as Effect from 'effect/Effect'
import type * as SqlClient from 'effect/sql/SqlClient'

type BranchLookup = (
  directoryIds: readonly string[],
) => Effect.Effect<ReadonlyMap<string, string | null>, unknown, SqlClient.SqlClient>

let branchLookup: BranchLookup | undefined

export function registerChatBranchFallbacks(lookup: BranchLookup) {
  if (branchLookup) throw new Error('Chat branch fallbacks are already composed.')
  branchLookup = lookup
  return () => {
    if (branchLookup === lookup) branchLookup = undefined
  }
}

export function applyChatBranchFallbacks<Row extends { branchName: string | null }>(
  rows: Row[],
  directoryId: (row: Row) => string,
) {
  const lookup = branchLookup
  if (!lookup) return Effect.succeed(rows)
  return Effect.gen(function* () {
    const directoryIds = [
      ...new Set(rows.filter((row) => row.branchName === null).map(directoryId)),
    ]
    if (directoryIds.length === 0) return rows
    const branches = yield* lookup(directoryIds)
    return rows.map((row) =>
      row.branchName === null
        ? { ...row, branchName: branches.get(directoryId(row)) ?? null }
        : row,
    )
  })
}
