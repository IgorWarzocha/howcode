import { describe, expect, it } from 'vitest'
import { repairConversationProjection } from './conversation-projection.ts'
import { registerConversationFacts } from './conversation-writes.ts'
import { makeThreadStateDatabaseRuntime } from './db.ts'
import {
  listArchivedProjectThreads,
  listArchivedThreads,
  listInboxThreads,
  listProjectThreads,
} from './queries.ts'
import { archiveThread } from './thread-writes.ts'

describe('core conversation persistence without plugins', () => {
  it('reads active, inbox and archived chat facts without optional storage', async () => {
    const runtime = makeThreadStateDatabaseRuntime(':memory:')
    try {
      for (const conversationId of ['active', 'archived']) {
        runtime.runSync(
          registerConversationFacts({
            conversationId,
            projectId: '/chat',
            title: conversationId,
            lastModifiedMs: 1,
            isChat: true,
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
      runtime.runSync(archiveThread('archived'))
      expect(
        runtime.runSync(listProjectThreads('/chat', { chat: true })).map((row) => row.id),
      ).toEqual(['active'])
      expect(runtime.runSync(listInboxThreads()).map((row) => row.threadId)).toEqual(['active'])
      expect(
        runtime.runSync(listArchivedProjectThreads('/chat', { chat: true })).map((row) => row.id),
      ).toEqual(['archived'])
      expect(runtime.runSync(listArchivedThreads()).map((row) => row.id)).toEqual(['archived'])
    } finally {
      await runtime.dispose()
    }
  })
})
