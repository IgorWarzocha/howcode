import { getThreadStateDatabase } from './db.ts'
import type { ThreadInboxMessageRecord } from './types.ts'
import { runInTransaction } from './write-transaction.ts'

export function upsertInboxThreadPrompt(sessionPath: string, prompt: string | null) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      INSERT INTO inbox_items (session_path, unread, last_user_prompt)
      VALUES (?, 0, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        last_user_prompt = excluded.last_user_prompt,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(sessionPath, prompt)
}

export function beginInboxThreadTurn(sessionPath: string, prompt: string | null) {
  const db = getThreadStateDatabase()
  const resetInboxItem = db.prepare(
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
  )
  const resetThreadAssistantSnapshot = db.prepare(
    `
      UPDATE threads
      SET
        last_assistant_message_json = NULL,
        last_assistant_preview = NULL,
        last_assistant_at_ms = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
  )

  runInTransaction(db, () => {
    resetInboxItem.run(sessionPath, prompt)
    resetThreadAssistantSnapshot.run(sessionPath)
  })
}

export function markInboxThreadRead(sessionPath: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      UPDATE inbox_items
      SET unread = 0, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
  ).run(sessionPath)
}

export function dismissInboxThread(sessionPath: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      DELETE FROM inbox_items
      WHERE session_path = ?
    `,
  ).run(sessionPath)
}

export function clearReadInboxThreads(olderThanMs: number | null = null) {
  const db = getThreadStateDatabase()
  const result = (
    olderThanMs
      ? db
          .prepare(
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
          )
          .run(olderThanMs)
      : db
          .prepare(
            `
            DELETE FROM inbox_items
            WHERE unread = 0
          `,
          )
          .run()
  ) as { changes: number }

  return result.changes
}

export function upsertInboxThreadMessage(record: ThreadInboxMessageRecord) {
  const db = getThreadStateDatabase()
  const serializedContent = JSON.stringify(record.content)

  db.prepare(
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
  ).run(
    record.sessionPath,
    record.userPrompt,
    serializedContent,
    record.preview,
    record.lastAssistantAtMs,
  )

  db.prepare(
    `
      UPDATE threads
      SET
        last_assistant_message_json = ?,
        last_assistant_preview = ?,
        last_assistant_at_ms = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
  ).run(serializedContent, record.preview, record.lastAssistantAtMs, record.sessionPath)
}
