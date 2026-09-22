import { mkdirSync } from 'node:fs'
import path from 'node:path'
import * as SqliteClient from '@effect/sql-sqlite-node/SqliteClient'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import type * as SqlClient from 'effect/unstable/sql/SqlClient'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { cleanupLegacyCheckpoints, initializeThreadStateSchema } from './schema.ts'
import { type DatabaseTransactions, databaseTransactionsLayer } from './write-transaction.ts'

type DatabaseServices = SqlClient.SqlClient | DatabaseTransactions

export function makeThreadStateDatabaseRuntime(filename: string) {
  const sqlite = Layer.unwrap(
    Effect.sync(() => {
      if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true })
      return SqliteClient.layer({ filename, busyTimeout: '5 seconds' })
    }),
  )
  const transactions = databaseTransactionsLayer.pipe(Layer.provideMerge(sqlite))
  const initialized = Layer.effectDiscard(
    Effect.gen(function* () {
      yield* initializeThreadStateSchema()
      yield* cleanupLegacyCheckpoints().pipe(
        Effect.catch((error) =>
          Effect.sync(() =>
            console.warn('Failed to complete legacy Git checkpoint cleanup.', error),
          ),
        ),
        Effect.forkScoped,
      )
    }),
  ).pipe(Layer.provideMerge(transactions))
  return ManagedRuntime.make(initialized)
}

let database: ReturnType<typeof makeThreadStateDatabaseRuntime> | undefined
let closed = false

function getDatabaseRuntime() {
  if (closed) throw new Error('Thread state database is closed.')
  database ??= makeThreadStateDatabaseRuntime(
    path.join(getDesktopUserDataPath(), 'state', 'desktop.sqlite'),
  )
  return database
}

// The Node driver is synchronous. Keep each repository operation in one JS turn
// so its queries cannot interleave with another caller's reads or writes.
export function databaseOperation<Args extends readonly unknown[], A, E>(
  operation: (...args: Args) => Effect.Effect<A, E, DatabaseServices>,
) {
  return (...args: Args): A => getDatabaseRuntime().runSync(operation(...args))
}

export async function disposeThreadStateDatabase() {
  closed = true
  await database?.dispose()
}
