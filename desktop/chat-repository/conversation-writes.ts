import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { ensureDirectory } from './conversation-scopes.ts'
import type { ConversationSummaryRecord } from './types.ts'
import { ensureDefaultWorkspace } from './workspace-organization.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

export const upsertChatSummary = Effect.fn('ConversationState.upsertSummary')(function* (
  conversation: ConversationSummaryRecord,
) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureDirectory(conversation.cwd)
  yield* sql`INSERT INTO conversation_facts (id, cwd, conversation_id, title, last_modified_ms, branch_name)
    VALUES (${conversation.conversationId}, ${conversation.cwd}, ${conversation.conversationId}, ${conversation.title}, ${conversation.lastModifiedMs}, ${conversation.branchName ?? null})
    ON CONFLICT(conversation_id) DO UPDATE SET last_modified_ms = excluded.last_modified_ms, updated_at = CURRENT_TIMESTAMP`
  return conversation.conversationId
})

export const registerConversationFacts = Effect.fn('ConversationState.register')(function* (input: {
  conversationId: string
  directoryId: string
  title: string
  lastModifiedMs: number
  branchName?: string | null | undefined
  workspaceId?: string | null | undefined
  composerProfile?: 'general' | 'coding' | undefined
}) {
  const sql = yield* SqlClient.SqlClient
  return yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const chatId = yield* upsertChatSummary({
        id: input.conversationId,
        conversationId: input.conversationId,
        cwd: input.directoryId,
        title: input.title,
        lastModifiedMs: input.lastModifiedMs,
        branchName: input.branchName,
      })
      const workspaceId =
        input.workspaceId ??
        (input.composerProfile === 'general' ? yield* ensureDefaultWorkspace() : null)
      if (input.composerProfile === 'general') {
        yield* sql`INSERT INTO chat_conversations (conversation_id, group_id)
        VALUES (${input.conversationId}, ${workspaceId})
        ON CONFLICT(conversation_id) DO NOTHING`
      }
      if (workspaceId) {
        yield* sql`UPDATE conversation_facts SET workspace_id = ${workspaceId}
          WHERE conversation_id = ${input.conversationId} AND workspace_id IS NULL`
      }
      return chatId
    }),
  )
})
