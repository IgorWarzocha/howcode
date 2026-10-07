import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { ensureProject } from './project-writes.ts'
import type { ConversationSummaryRecord } from './types.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

export const upsertThreadSummary = Effect.fn('ConversationState.upsertSummary')(function* (
  conversation: ConversationSummaryRecord,
) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureProject(conversation.cwd)
  yield* sql`INSERT INTO conversation_facts (id, cwd, conversation_id, title, last_modified_ms, branch_name)
    VALUES (${conversation.conversationId}, ${conversation.cwd}, ${conversation.conversationId}, ${conversation.title}, ${conversation.lastModifiedMs}, ${conversation.branchName ?? null})
    ON CONFLICT(conversation_id) DO UPDATE SET last_modified_ms = excluded.last_modified_ms, updated_at = CURRENT_TIMESTAMP`
  return conversation.conversationId
})

export const registerConversationFacts = Effect.fn('ConversationState.register')(function* (input: {
  conversationId: string
  projectId: string
  title: string
  lastModifiedMs: number
  branchName?: string | null | undefined
  chatGroupId?: string | null | undefined
  isChat?: boolean | undefined
}) {
  const sql = yield* SqlClient.SqlClient
  return yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const threadId = yield* upsertThreadSummary({
        id: input.conversationId,
        conversationId: input.conversationId,
        cwd: input.projectId,
        title: input.title,
        lastModifiedMs: input.lastModifiedMs,
        branchName: input.branchName,
      })
      if (input.isChat)
        yield* sql`INSERT INTO chat_conversations (conversation_id, group_id)
        VALUES (${input.conversationId}, ${input.chatGroupId ?? null})
        ON CONFLICT(conversation_id) DO NOTHING`
      return threadId
    }),
  )
})
