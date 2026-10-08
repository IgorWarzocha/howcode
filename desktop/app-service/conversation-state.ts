import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import { registerConversationFacts } from '../thread-state-db/conversation-writes.ts'
import { databaseOperation } from '../thread-state-db/db.ts'
import { decodePersistedRows } from '../thread-state-db/row-schema.ts'

const registerFacts = databaseOperation(registerConversationFacts)

const ConversationMetadataSchema = Schema.Struct({
  projectId: Schema.String,
  title: Schema.String,
  deleted: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  chatGroupId: Schema.NullOr(Schema.String),
  isChat: Schema.Number,
})

export const getRuntimeConversationMetadata = databaseOperation(
  Effect.fn('ConversationState.metadata')(function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      ConversationMetadataSchema,
      yield* sql`
      SELECT conversation_facts.cwd AS projectId, title, deleted, branch_name AS branchName,
        conversation_facts.workspace_id AS chatGroupId,
        CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
      FROM conversation_facts LEFT JOIN chat_conversations ON chat_conversations.conversation_id = conversation_facts.conversation_id
      WHERE conversation_facts.conversation_id = ${conversationId}
    `,
      'conversation metadata',
    )
    const row = rows[0]
    return row ? { ...row, deleted: Boolean(row.deleted), isChat: Boolean(row.isChat) } : null
  }),
)

export function registerRuntimeConversation(input: {
  conversationId: string
  projectId: string
  branchName?: string | null | undefined
  chatGroupId?: string | null | undefined
  isChat?: boolean | undefined
  title?: string | undefined
  lastModifiedMs?: number | undefined
}) {
  const existing = getRuntimeConversationMetadata(input.conversationId)
  if (existing?.deleted) throw new Error('Conversation was deleted.')
  if (existing) return input.conversationId
  return registerFacts({
    ...input,
    title: input.title ?? 'New chat',
    lastModifiedMs: input.lastModifiedMs ?? Date.now(),
  })
}
