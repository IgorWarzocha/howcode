import { Effect } from 'effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { ThreadInboxMessageRecord } from './types.ts'
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

export const upsertInboxThreadPrompt = Effect.fn('threadStateDb.upsertInboxThreadPrompt')(
  function* (sessionPath: string, prompt: string | null) {
    const sql = yield* SqlClient.SqlClient
    yield* sql.unsafe(
      `
      INSERT INTO inbox_items (session_path, unread, last_user_prompt)
      VALUES (?, 0, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        last_user_prompt = excluded.last_user_prompt,
        updated_at = CURRENT_TIMESTAMP
    `,
      [sessionPath, prompt],
    )
  },
)

export const beginInboxThreadTurn = Effect.fn('threadStateDb.beginInboxThreadTurn')(function* (
  sessionPath: string,
  prompt: string | null,
) {
  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      yield* sql.unsafe(
        `
            INSERT INTO inbox_items (
              session_path,
              unread,
              last_user_prompt,
              last_assistant_message_json,
              last_assistant_preview,
              last_assistant_at_ms
            )
            VALUES (?, 0, ?, NULL, NULL, NULL)
            ON CONFLICT(session_path) DO UPDATE SET
              unread = 0,
              last_user_prompt = excluded.last_user_prompt,
              last_assistant_message_json = NULL,
              last_assistant_preview = NULL,
              last_assistant_at_ms = NULL,
              updated_at = CURRENT_TIMESTAMP
          `,
        [sessionPath, prompt],
      )
      yield* sql.unsafe(
        `
            UPDATE threads
            SET
              last_assistant_message_json = NULL,
              last_assistant_preview = NULL,
              last_assistant_at_ms = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE session_path = ?
          `,
        [sessionPath],
      )
    }),
  )
})

export const markInboxThreadRead = Effect.fn('threadStateDb.markInboxThreadRead')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE inbox_items
      SET unread = 0, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
    [sessionPath],
  )
})

export const dismissInboxThread = Effect.fn('threadStateDb.dismissInboxThread')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      DELETE FROM inbox_items
      WHERE session_path = ?
    `,
    [sessionPath],
  )
})

export const dismissInboxThreadAfterReply = Effect.fn('threadStateDb.dismissInboxThreadAfterReply')(
  function* (sessionPath: string) {
    const sql = yield* SqlClient.SqlClient
    yield* withDatabaseTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(
          `
            DELETE FROM inbox_items
            WHERE session_path = ?
          `,
          [sessionPath],
        )
        yield* sql.unsafe(
          `
            INSERT INTO inbox_reply_suppressions (session_path)
            VALUES (?)
            ON CONFLICT(session_path) DO UPDATE SET
              created_at = CURRENT_TIMESTAMP
          `,
          [sessionPath],
        )
      }),
    )
  },
)

export const consumeInboxReplySuppression = Effect.fn('threadStateDb.consumeInboxReplySuppression')(
  function* (sessionPath: string) {
    const sql = yield* SqlClient.SqlClient
    return yield* withDatabaseTransaction(
      Effect.gen(function* () {
        const result = yield* sql.unsafe(
          `
          DELETE FROM inbox_reply_suppressions
          WHERE session_path = ?
        `,
          [sessionPath],
        ).raw
        const changes = getChanges(result, 'inbox reply suppression delete')
        if (changes > 0) {
          yield* sql.unsafe(
            `
          DELETE FROM inbox_items
          WHERE session_path = ?
        `,
            [sessionPath],
          )
        }
        return changes > 0
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
            DELETE FROM inbox_items
            WHERE unread = 0
          `,
      ).raw
    : sql.unsafe(
        `
            DELETE FROM inbox_items
            WHERE unread = 0
              AND COALESCE(
                last_assistant_at_ms,
                unixepoch(updated_at) * 1000,
                unixepoch(created_at) * 1000,
                0
              ) < ?
          `,
        [olderThanMs],
      ).raw

  return getChanges(result, 'clear read inbox threads')
})

export const upsertInboxThreadMessage = Effect.fn('threadStateDb.upsertInboxThreadMessage')(
  function* (record: ThreadInboxMessageRecord) {
    const sql = yield* SqlClient.SqlClient
    const serializedContent = JSON.stringify(record.content)

    yield* sql.unsafe(
      `
      INSERT INTO inbox_items (
        session_path,
        unread,
        last_user_prompt,
        last_assistant_message_json,
        last_assistant_preview,
        last_assistant_at_ms
      )
      VALUES (?, 1, ?, ?, ?, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        unread = 1,
        last_user_prompt = excluded.last_user_prompt,
        last_assistant_message_json = excluded.last_assistant_message_json,
        last_assistant_preview = excluded.last_assistant_preview,
        last_assistant_at_ms = excluded.last_assistant_at_ms,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        record.sessionPath,
        record.userPrompt,
        serializedContent,
        record.preview,
        record.lastAssistantAtMs,
      ],
    )

    yield* sql.unsafe(
      `
      UPDATE threads
      SET
        last_assistant_message_json = ?,
        last_assistant_preview = ?,
        last_assistant_at_ms = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
      [serializedContent, record.preview, record.lastAssistantAtMs, record.sessionPath],
    )
  },
)
