import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import { databaseOperation } from '../chat-repository/db.ts'

const DeviceId = Schema.String.check(Schema.isUUID())

// Installation identity belongs to Howcode, not the possibly shared Pi directory.
export const getProviderAuthDeviceId = databaseOperation(
  Effect.fn('ProviderAuth.getDeviceId')(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`INSERT INTO app_preferences (key, value_json)
      VALUES ('providerAuthDeviceId', ${JSON.stringify(randomUUID())})
      ON CONFLICT(key) DO NOTHING`
    const rows = yield* sql<{ value_json: string }>`SELECT value_json FROM app_preferences
      WHERE key = 'providerAuthDeviceId'`
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(DeviceId))(rows[0]?.value_json)
  }),
)
