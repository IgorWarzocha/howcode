import type { PeopleStorage } from '@howaboua/howcode-sdk/people'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { databaseOperation } from './chat-repository/db.ts'

/** Keep the original key in place; People owns the value's schema and mutation rules. */
export const peopleStorage: PeopleStorage = {
  read: databaseOperation(
    Effect.fn('PeopleStorage.read')(function* () {
      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql.unsafe<{ valueJson: string }>(
        "SELECT value_json AS valueJson FROM app_preferences WHERE key = 'people'",
      )
      return JSON.parse(rows[0]?.valueJson ?? '[]')
    }),
  ),
  write: databaseOperation(
    Effect.fn('PeopleStorage.write')(function* (value: unknown) {
      const sql = yield* SqlClient.SqlClient
      yield* sql.unsafe(
        `INSERT INTO app_preferences (key, value_json) VALUES ('people', ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(value)],
      )
    }),
  ),
}
