import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { describe, expect, it } from 'vitest'
import { repairConversationProjection } from '../../../../desktop/thread-state-db/conversation-projection.ts'
import { registerConversationFacts } from '../../../../desktop/thread-state-db/conversation-writes.ts'
import { makeThreadStateDatabaseRuntime } from '../../../../desktop/thread-state-db/db.ts'
import {
  listInboxThreads,
  listProjectThreads,
} from '../../../../desktop/thread-state-db/queries.ts'
import { registerThreadBranchFallbacks } from '../../../../desktop/thread-state-db/thread-branch-fallbacks.ts'
import { codingDatabaseSchema } from '../schema.ts'
import { codingThreadBranchFallbacks } from './thread-branches.ts'

describe('coding thread branch projection', () => {
  it('preserves legacy worktree attribution without overriding explicit conversation branches', async () => {
    const runtime = makeThreadStateDatabaseRuntime(':memory:', [codingDatabaseSchema])
    const unregister = registerThreadBranchFallbacks(codingThreadBranchFallbacks)
    try {
      for (const conversationId of ['legacy', 'explicit']) {
        runtime.runSync(
          registerConversationFacts({
            conversationId,
            projectId: '/worktree',
            title: conversationId,
            lastModifiedMs: 1,
            isChat: true,
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
      const threads = runtime.runSync(listProjectThreads('/worktree'))
      expect(new Map(threads.map((row) => [row.id, row.branchName]))).toEqual(
        new Map([
          ['legacy', 'legacy-branch'],
          ['explicit', 'explicit-branch'],
        ]),
      )
      expect(runtime.runSync(listProjectThreads('/worktree', { chat: true }))).toEqual([])
      expect(
        runtime.runSync(listInboxThreads()).find((row) => row.threadId === 'legacy')?.branchName,
      ).toBe('legacy-branch')
    } finally {
      unregister()
      await runtime.dispose()
    }
  })
})
