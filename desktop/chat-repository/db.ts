import { mkdirSync } from 'node:fs'
import path from 'node:path'
import * as SqliteClient from '@effect/sql-sqlite-node/SqliteClient'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import type * as SqlClient from 'effect/sql/SqlClient'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { type DatabaseSchema, initializeChatStateSchema } from './schema.ts'
import { type DatabaseTransactions, databaseTransactionsLayer } from './write-transaction.ts'

type DatabaseServices = SqlClient.SqlClient | DatabaseTransactions

type DatabaseStartupTask = Effect.Effect<void, unknown, SqlClient.SqlClient>
const startupTasks = new Set<DatabaseStartupTask>()
let databaseSchemas: readonly DatabaseSchema[] = []

export function configureDatabaseSchemas(contributions: readonly DatabaseSchema[]) {
  if (database) throw new Error('Database schemas must be composed before database demand.')
  databaseSchemas = [...contributions]
}

export function registerDatabaseStartupTask(task: DatabaseStartupTask) {
  if (database) throw new Error('Database startup tasks must be composed before database demand.')
  startupTasks.add(task)
  return () => startupTasks.delete(task)
}

export function makeChatStateDatabaseRuntime(
  filename: string,
  contributions: readonly DatabaseSchema[] = [],
) {
  const sqlite = Layer.unwrap(
    Effect.sync(() => {
      if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true })
      return SqliteClient.layer({ filename, busyTimeout: '5 seconds' })
    }),
  )
  const transactions = databaseTransactionsLayer.pipe(Layer.provideMerge(sqlite))
  const initialized = Layer.effectDiscard(
    Effect.gen(function* () {
      yield* initializeChatStateSchema(contributions)
      for (const task of startupTasks) {
        yield* task.pipe(
          Effect.catch((error) =>
            Effect.sync(() => console.warn('Database startup task failed.', error)),
          ),
          Effect.forkScoped,
        )
      }
    }),
  ).pipe(Layer.provideMerge(transactions))
  return ManagedRuntime.make(initialized)
}

let database: ReturnType<typeof makeChatStateDatabaseRuntime> | undefined
let closed = false

function getDatabaseRuntime() {
  if (closed) throw new Error('Chat state database is closed.')
  database ??= makeChatStateDatabaseRuntime(
    path.join(getDesktopUserDataPath(), 'state', 'desktop.sqlite'),
    databaseSchemas,
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

/** Component-owned migrations join this database runtime and their own disposal. */
export function runDatabaseTask(task: DatabaseStartupTask) {
  return getDatabaseRuntime().runPromise(task)
}

export async function disposeChatStateDatabase() {
  closed = true
  await database?.dispose()
}
