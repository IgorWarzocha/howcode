import { describe, expect, it } from 'vitest'
import { archiveChat } from './chat-writes.ts'
import { repairConversationProjection } from './conversation-projection.ts'
import { registerConversationFacts } from './conversation-writes.ts'
import { makeChatStateDatabaseRuntime } from './db.ts'
import {
  listArchivedChats,
  listArchivedDirectoryChats,
  listDirectoryChats,
  listInboxChats,
} from './queries.ts'

describe('core conversation persistence without plugins', () => {
  it('reads active, inbox and archived chat facts without optional storage', async () => {
    const runtime = makeChatStateDatabaseRuntime(':memory:')
    try {
      for (const conversationId of ['active', 'archived']) {
        runtime.runSync(
          registerConversationFacts({
            conversationId,
            directoryId: '/chat',
            title: conversationId,
            lastModifiedMs: 1,
            composerProfile: 'general',
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
      runtime.runSync(archiveChat('archived'))
      expect(runtime.runSync(listDirectoryChats('/chat')).map((row) => row.id)).toEqual(['active'])
      expect(runtime.runSync(listInboxChats()).map((row) => row.chatId)).toEqual(['active'])
      expect(runtime.runSync(listArchivedDirectoryChats('/chat')).map((row) => row.id)).toEqual([
        'archived',
      ])
      expect(runtime.runSync(listArchivedChats()).map((row) => row.id)).toEqual(['archived'])
    } finally {
      await runtime.dispose()
    }
  })
})
