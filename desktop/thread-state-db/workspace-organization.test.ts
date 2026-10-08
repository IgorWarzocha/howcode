import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { describe, expect, it } from 'vitest'
import { registerConversationFacts } from './conversation-writes.ts'
import { makeThreadStateDatabaseRuntime } from './db.ts'
import {
  DEFAULT_WORKSPACE_ID,
  moveWorkspaceChat,
  reconcileWorkspaceOrganization,
  renameWorkspace,
} from './workspace-organization.ts'

describe('workspace organization migration', () => {
  it('upgrades an old database and preserves rename and cross-workspace moves across restart', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'howcode-workspace-migration-'))
    const filename = path.join(directory, 'state.sqlite')
    let runtime = makeThreadStateDatabaseRuntime(filename)
    const directories = [{ id: '/repo', name: 'Repository', rootId: '/repo' }]
    try {
      await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`INSERT INTO chat_groups (id, name) VALUES ('general', 'Research')`
          yield* registerConversationFacts({
            conversationId: 'code',
            projectId: '/repo',
            title: 'Keep title',
            lastModifiedMs: 42,
          })
          yield* registerConversationFacts({
            conversationId: 'chat',
            projectId: '/repo',
            title: 'Keep chat',
            lastModifiedMs: 43,
            isChat: true,
            chatGroupId: 'general',
          })
        }),
      )
      await runtime.dispose()
      const legacy = new DatabaseSync(filename)
      try {
        legacy.exec(
          'ALTER TABLE conversation_facts DROP COLUMN workspace_id; ALTER TABLE chat_groups DROP COLUMN directory_id;',
        )
      } finally {
        legacy.close()
      }
      runtime = makeThreadStateDatabaseRuntime(filename)
      await runtime.runPromise(reconcileWorkspaceOrganization(directories))
      await runtime.runPromise(renameWorkspace('directory:/repo', 'Writing'))
      await runtime.runPromise(moveWorkspaceChat('code', 'general'))
      await runtime.runPromise(moveWorkspaceChat('chat', 'directory:/repo'))
      await runtime.dispose()
      runtime = makeThreadStateDatabaseRuntime(filename)
      const savedName = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return (yield* sql<{
            name: string
          }>`SELECT custom_name AS name FROM projects WHERE cwd = '/repo'`)[0]?.name
        }),
      )
      expect(savedName).toBe('Writing')
      // A directory discovery started before a rename must not undo that rename.
      await runtime.runPromise(reconcileWorkspaceOrganization(directories))
      const workspaceName = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return (yield* sql<{
            name: string
          }>`SELECT name FROM chat_groups WHERE id = 'directory:/repo'`)[0]?.name
        }),
      )
      expect(workspaceName).toBe('Writing')
      const rows = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql`SELECT facts.conversation_id AS id, facts.workspace_id AS workspace, facts.cwd, facts.title,
          CASE WHEN legacy.conversation_id IS NULL THEN 0 ELSE 1 END AS isChat
          FROM conversation_facts facts LEFT JOIN chat_conversations legacy ON legacy.conversation_id = facts.conversation_id ORDER BY id`
        }),
      )
      expect(rows).toEqual([
        { id: 'chat', workspace: 'directory:/repo', cwd: '/repo', title: 'Keep chat', isChat: 1 },
        { id: 'code', workspace: 'general', cwd: '/repo', title: 'Keep title', isChat: 0 },
      ])
      await expect(runtime.runPromise(moveWorkspaceChat('code', 'missing'))).rejects.toThrow(
        'Workspace not found.',
      )
      const unchangedWorkspace = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return (yield* sql<{
            id: string
          }>`SELECT workspace_id AS id FROM conversation_facts WHERE conversation_id = 'code'`)[0]
            ?.id
        }),
      )
      expect(unchangedWorkspace).toBe('general')
      await runtime.runPromise(
        registerConversationFacts({
          conversationId: 'new-code',
          projectId: '/repo',
          title: 'New code chat',
          lastModifiedMs: 50,
          chatGroupId: 'general',
          isChat: false,
        }),
      )
      const independentContext = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql`SELECT facts.workspace_id AS workspace, legacy.conversation_id AS legacyChat
          FROM conversation_facts facts LEFT JOIN chat_conversations legacy ON legacy.conversation_id = facts.conversation_id
          WHERE facts.conversation_id = 'new-code'`
        }),
      )
      expect(independentContext).toEqual([{ workspace: 'general', legacyChat: null }])
    } finally {
      await runtime.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
  it('preserves legacy grouping and composer ownership while organizing directories and worktrees idempotently', async () => {
    const runtime = makeThreadStateDatabaseRuntime(':memory:')
    try {
      await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`INSERT INTO chat_groups (id, name, order_index, collapsed) VALUES ('existing', 'Research', 3, 1)`
          for (const [conversationId, projectId, isChat] of [
            ['standalone', '/repo', true],
            ['grouped', '/repo', true],
            ['coding', '/repo', false],
            ['worktree', '/worktree', false],
          ] as const) {
            yield* registerConversationFacts({
              conversationId,
              projectId,
              title: conversationId,
              lastModifiedMs: 10,
              isChat,
              chatGroupId: isChat ? 'existing' : null,
            })
          }
          // Simulate records created before universal workspace membership existed.
          yield* sql`UPDATE conversation_facts SET workspace_id = NULL`
          yield* sql`UPDATE chat_conversations SET group_id = NULL WHERE conversation_id = 'standalone'`
        }),
      )
      const directories = [
        { id: '/repo', name: 'Repository', rootId: '/repo' },
        { id: '/worktree', name: 'Branch', rootId: '/repo' },
      ]
      await runtime.runPromise(reconcileWorkspaceOrganization(directories))
      await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          // User organization must survive subsequent startup reconciliation.
          yield* sql`UPDATE conversation_facts SET workspace_id = 'existing' WHERE conversation_id = 'coding'`
        }),
      )
      await runtime.runPromise(reconcileWorkspaceOrganization(directories))
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return {
            facts:
              yield* sql`SELECT conversation_id AS id, workspace_id AS workspace, cwd, title FROM conversation_facts ORDER BY id`,
            legacy:
              yield* sql`SELECT conversation_id AS id, group_id AS workspace FROM chat_conversations ORDER BY id`,
            groups:
              yield* sql`SELECT id, name, collapsed, order_index AS position FROM chat_groups ORDER BY id`,
          }
        }),
      )
      expect(result.facts).toEqual([
        { id: 'coding', workspace: 'existing', cwd: '/repo', title: 'coding' },
        { id: 'grouped', workspace: 'existing', cwd: '/repo', title: 'grouped' },
        { id: 'standalone', workspace: DEFAULT_WORKSPACE_ID, cwd: '/repo', title: 'standalone' },
        { id: 'worktree', workspace: 'directory:/repo', cwd: '/worktree', title: 'worktree' },
      ])
      expect(result.legacy).toEqual([
        { id: 'grouped', workspace: 'existing' },
        { id: 'standalone', workspace: null },
      ])
      expect(result.groups).toEqual([
        { id: 'directory:/repo', name: 'Repository', collapsed: 0, position: null },
        { id: 'existing', name: 'Research', collapsed: 1, position: 3 },
        { id: DEFAULT_WORKSPACE_ID, name: 'Personal', collapsed: 0, position: -1 },
      ])
    } finally {
      await runtime.dispose()
    }
  })
})
