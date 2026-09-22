import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { Connection } from 'effect/unstable/sql/SqlConnection'

export class DatabaseTransactions extends Context.Service<
  DatabaseTransactions,
  { readonly withTransaction: SqlClient.SqlClient['withTransaction'] }
>()('howcode/DatabaseTransactions') {}

function control(connection: Connection, statement: string) {
  return connection.executeUnprepared(statement, [], undefined).pipe(Effect.asVoid)
}

export const databaseTransactionsLayer = Layer.effect(
  DatabaseTransactions,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // Preserve deferred locking. The driver's default BEGIN IMMEDIATE would take
    // the write lock before the first write, unlike our existing transactions.
    const withTransaction = SqlClient.makeWithTransaction({
      transactionService: sql.transactionService,
      spanAttributes: [['db.system.name', 'sqlite']],
      acquireConnection: Effect.gen(function* () {
        const scope = yield* Scope.make()
        const connection = yield* Scope.provide(sql.reserve, scope)
        return [scope, connection] as const
      }),
      begin: (connection) => control(connection, 'BEGIN'),
      commit: (connection) => control(connection, 'COMMIT'),
      rollback: (connection) => control(connection, 'ROLLBACK'),
      savepoint: (connection, id) => control(connection, `SAVEPOINT howcode_${id}`),
      rollbackSavepoint: (connection, id) =>
        control(connection, `ROLLBACK TO SAVEPOINT howcode_${id}`),
    })
    return DatabaseTransactions.of({ withTransaction })
  }),
)

export function withDatabaseTransaction<A, E, R>(operation: Effect.Effect<A, E, R>) {
  return Effect.flatMap(DatabaseTransactions, (transactions) =>
    transactions.withTransaction(operation),
  )
}
