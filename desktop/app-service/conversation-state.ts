import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import { registerConversationFacts } from '../chat-repository/conversation-writes.ts'
import { databaseOperation } from '../chat-repository/db.ts'
import { decodePersistedRows } from '../chat-repository/row-schema.ts'

const registerFacts = databaseOperation(registerConversationFacts)

const ConversationMetadataSchema = Schema.Struct({
  directoryId: Schema.String,
  title: Schema.String,
  deleted: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  workspaceId: Schema.NullOr(Schema.String),
  isChat: Schema.Number,
})

export const getRuntimeConversationMetadata = databaseOperation(
  Effect.fn('ConversationState.metadata')(function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      ConversationMetadataSchema,
      yield* sql`
      SELECT conversation_facts.cwd AS directoryId, title, deleted, branch_name AS branchName,
        conversation_facts.workspace_id AS workspaceId,
        CASE WHEN chat_conversations.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
      FROM conversation_facts LEFT JOIN chat_conversations ON chat_conversations.conversation_id = conversation_facts.conversation_id
      WHERE conversation_facts.conversation_id = ${conversationId}
    `,
      'conversation metadata',
    )
    const row = rows[0]
    if (!row) return null
    const { isChat, ...metadata } = row
    return {
      ...metadata,
      deleted: Boolean(row.deleted),
      composerProfile: isChat ? ('general' as const) : ('coding' as const),
    }
  }),
)

export function registerRuntimeConversation(input: {
  conversationId: string
  directoryId: string
  branchName?: string | null | undefined
  workspaceId?: string | null | undefined
  composerProfile?: 'general' | 'coding' | undefined
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
