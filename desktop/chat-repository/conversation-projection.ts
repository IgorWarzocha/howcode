import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import {
  DEFAULT_WORKSPACE_ID,
  type WorkspaceActivity,
} from '../../shared/desktop-workspace-contracts.ts'
import { decodePersistedRows } from './row-schema.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

const updateInboxNotification = Effect.fn('ConversationState.updateNotification')(function* (
  conversationId: string,
  assistantId: string | null,
  running: boolean,
) {
  if (running || assistantId === null) return
  const sql = yield* SqlClient.SqlClient
  const previous = (yield* sql<{
    assistantId: string | null
  }>`SELECT notification_assistant_id AS assistantId FROM conversation_inbox WHERE conversation_id = ${conversationId}`)[0]
  if (previous?.assistantId === assistantId) return
  const suppressed =
    yield* sql`DELETE FROM conversation_reply_suppressions WHERE conversation_id = ${conversationId} RETURNING conversation_id`
  const dismissed = Number(suppressed.length > 0)
  yield* sql`INSERT INTO conversation_inbox (conversation_id, unread, dismissed, notification_assistant_id)
    VALUES (${conversationId}, ${1 - dismissed}, ${dismissed}, ${assistantId})
    ON CONFLICT(conversation_id) DO UPDATE SET unread = excluded.unread,
      dismissed = excluded.dismissed, notification_assistant_id = excluded.notification_assistant_id,
      updated_at = CURRENT_TIMESTAMP`
})

export const repairConversationProjection = Effect.fn('ConversationState.repairProjection')(
  function* (input: {
    conversationId: string
    entryId: string | null
    assistantId: string | null
    preview: string | null
    title: string
    lastModifiedMs: number
    lastHumanInputAtMs: number | null
    running: boolean
  }) {
    const sql = yield* SqlClient.SqlClient
    const running = Number(input.running)
    yield* withDatabaseTransaction(
      Effect.gen(function* () {
        const row = (yield* sql<{
          entryId: string | null
          assistantId: string | null
          deleted: number
        }>`
      SELECT projection_entry_id AS entryId, projection_assistant_id AS assistantId, deleted
      FROM conversation_facts WHERE conversation_id = ${input.conversationId}
    `)[0]
        if (!row || row.deleted) return
        const changed = row.entryId !== input.entryId
        const newAssistant = input.assistantId !== null && row.assistantId !== input.assistantId
        yield* sql`UPDATE conversation_facts SET
      title = COALESCE(custom_title, ${input.title}),
      projection_entry_id = ${input.entryId},
      projection_assistant_id = CASE WHEN ${running} THEN projection_assistant_id ELSE ${input.assistantId} END,
      last_assistant_preview = ${input.preview}, running = ${running},
      last_human_input_at_ms = ${input.lastHumanInputAtMs},
      last_modified_ms = CASE WHEN ${Number(changed)} THEN MAX(last_modified_ms, ${input.lastModifiedMs}) ELSE last_modified_ms END,
      last_assistant_at_ms = CASE WHEN ${Number(newAssistant)} THEN ${input.lastModifiedMs} ELSE last_assistant_at_ms END
      WHERE conversation_id = ${input.conversationId}`
        yield* updateInboxNotification(input.conversationId, input.assistantId, input.running)
      }),
    )
  },
)

const WorkspaceActivityRowSchema = Schema.Struct({
  workspaceId: Schema.String,
  lastHumanInputAtMs: Schema.NullOr(Schema.Number),
  lastHowcodeActivityAtMs: Schema.NullOr(Schema.Number),
})

export const listWorkspaceActivity = Effect.fn('ConversationState.workspaceActivity')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql`
    SELECT chat_groups.id AS workspaceId,
      MAX(conversation_facts.last_human_input_at_ms) AS lastHumanInputAtMs,
      MAX(conversation_facts.last_modified_ms) AS lastHowcodeActivityAtMs
    FROM chat_groups
    LEFT JOIN conversation_facts
      ON COALESCE(conversation_facts.workspace_id, ${DEFAULT_WORKSPACE_ID}) = chat_groups.id
      AND conversation_facts.deleted = 0
    GROUP BY chat_groups.id
  `
  const activity: WorkspaceActivity[] = decodePersistedRows(
    WorkspaceActivityRowSchema,
    rows,
    'workspace activity',
  )
  return activity
})

export const listDirectoryUsageConversations = Effect.fn('ConversationState.usageConversations')(
  function* (directoryId: string) {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<{
      id: string
      conversationId: string
      title: string
      lastModifiedMs: number
    }>`
    SELECT id, conversation_id AS conversationId, title, last_modified_ms AS lastModifiedMs
    FROM conversation_facts WHERE cwd = ${directoryId}
  `
  },
)
