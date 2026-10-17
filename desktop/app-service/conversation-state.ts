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
})

export const getRuntimeConversationMetadata = databaseOperation(
  Effect.fn('ConversationState.metadata')(function* (conversationId: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = decodePersistedRows(
      ConversationMetadataSchema,
      yield* sql`
      SELECT conversation_facts.cwd AS directoryId, title, deleted, branch_name AS branchName,
        conversation_facts.workspace_id AS workspaceId
      FROM conversation_facts
      WHERE conversation_facts.conversation_id = ${conversationId}
    `,
      'conversation metadata',
    )
    const row = rows[0]
    if (!row) return null
    return {
      ...row,
      deleted: Boolean(row.deleted),
    }
  }),
)

export function registerRuntimeConversation(input: {
  conversationId: string
  directoryId: string
  branchName?: string | null | undefined
  workspaceId?: string | null | undefined
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
