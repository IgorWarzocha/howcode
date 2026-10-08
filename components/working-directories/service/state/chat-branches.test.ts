import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { describe, expect, it } from 'vitest'
import { registerChatBranchFallbacks } from '../../../../desktop/chat-repository/chat-branch-fallbacks.ts'
import { repairConversationProjection } from '../../../../desktop/chat-repository/conversation-projection.ts'
import { registerConversationFacts } from '../../../../desktop/chat-repository/conversation-writes.ts'
import { makeChatStateDatabaseRuntime } from '../../../../desktop/chat-repository/db.ts'
import { listDirectoryChats, listInboxChats } from '../../../../desktop/chat-repository/queries.ts'
import { workingDirectoriesDatabaseSchema } from '../schema.ts'
import { workingDirectoryChatBranchFallbacks } from './chat-branches.ts'

describe('coding thread branch projection', () => {
  it('preserves legacy worktree attribution without overriding explicit conversation branches', async () => {
    const runtime = makeChatStateDatabaseRuntime(':memory:', [workingDirectoriesDatabaseSchema])
    const unregister = registerChatBranchFallbacks(workingDirectoryChatBranchFallbacks)
    try {
      for (const conversationId of ['legacy', 'explicit']) {
        runtime.runSync(
          registerConversationFacts({
            conversationId,
            directoryId: '/worktree',
            title: conversationId,
            lastModifiedMs: 1,
            composerProfile: 'general',
            ...(conversationId === 'explicit' ? { branchName: 'explicit-branch' } : {}),
          }),
        )
        runtime.runSync(
          repairConversationProjection({
            conversationId,
            entryId: 'entry',
            assistantId: 'assistant',
            preview: 'reply',
            title: conversationId,
            lastModifiedMs: 2,
            running: false,
          }),
        )
      }
      runtime.runSync(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`INSERT INTO project_worktrees (cwd, root_cwd, branch_name, is_main)
          VALUES ('/worktree', '/worktree', 'legacy-branch', 0)`
        }),
      )
      const chats = runtime.runSync(listDirectoryChats('/worktree'))
      expect(new Map(chats.map((row) => [row.id, row.branchName]))).toEqual(
        new Map([
          ['legacy', 'legacy-branch'],
          ['explicit', 'explicit-branch'],
        ]),
      )
      expect(
        runtime.runSync(listInboxChats()).find((row) => row.chatId === 'legacy')?.branchName,
      ).toBe('legacy-branch')
    } finally {
      unregister()
      await runtime.dispose()
    }
  })
})
