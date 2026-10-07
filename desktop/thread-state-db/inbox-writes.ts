import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { withDatabaseTransaction } from './write-transaction.ts'

function getChanges(result: unknown, operation: string) {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('changes' in result) ||
    typeof result.changes !== 'number'
  ) {
    throw new Error(`Invalid ${operation} result.`)
  }
  return result.changes
}

export const markInboxThreadRead = Effect.fn('threadStateDb.markInboxThreadRead')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_inbox
      SET unread = 0, updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `,
    [conversationId],
  )
})

export const dismissInboxThread = Effect.fn('threadStateDb.dismissInboxThread')(function* (
  conversationId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_inbox SET dismissed = 1, unread = 0
      WHERE conversation_id = ?
    `,
    [conversationId],
  )
})

export const dismissInboxThreadAfterReply = Effect.fn('threadStateDb.dismissInboxThreadAfterReply')(
  function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    yield* withDatabaseTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(
          `
            UPDATE conversation_inbox SET dismissed = 1, unread = 0
            WHERE conversation_id = ?
          `,
          [conversationId],
        )
        yield* sql.unsafe(
          `
            INSERT INTO conversation_reply_suppressions (conversation_id)
            VALUES (?)
            ON CONFLICT(conversation_id) DO UPDATE SET
              created_at = CURRENT_TIMESTAMP
          `,
          [conversationId],
        )
      }),
    )
  },
)

export const clearReadInboxThreads = Effect.fn('threadStateDb.clearReadInboxThreads')(function* (
  olderThanMs: number | null = null,
) {
  const sql = yield* SqlClient.SqlClient
  const result = yield* olderThanMs === null
    ? sql.unsafe(
        `
            UPDATE conversation_inbox SET dismissed = 1, unread = 0
            WHERE unread = 0 AND dismissed = 0
          `,
      ).raw
    : sql.unsafe(
        `
            UPDATE conversation_inbox SET dismissed = 1, unread = 0
            WHERE unread = 0 AND dismissed = 0
              AND COALESCE(
                  unixepoch(updated_at) * 1000,
                unixepoch(created_at) * 1000,
                0
              ) < ?
          `,
        [olderThanMs],
      ).raw

  return getChanges(result, 'clear read inbox conversations')
})
