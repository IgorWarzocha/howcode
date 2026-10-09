import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { expect, it } from 'vitest'
import { registerConversationFacts } from './conversation-writes.ts'
import { makeChatStateDatabaseRuntime } from './db.ts'
import { requestWorkspaceLayout } from './workspace-layout.ts'
import { moveWorkspaceChat } from './workspace-organization.ts'

it('seeds independent layouts, preserves them across restart and moves, and rejects stale writes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-layout-'))
  const filename = path.join(directory, 'state.sqlite')
  let runtime = makeChatStateDatabaseRuntime(filename)
  const register = (conversationId: string) =>
    runtime.runPromise(
      registerConversationFacts({
        conversationId,
        directoryId: '/repo',
        title: conversationId,
        lastModifiedMs: 1,
        composerProfile: 'general',
        workspaceId: 'workspace',
      }),
    )
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        yield* sql`INSERT INTO chat_groups (id, name) VALUES ('workspace', 'Workspace'), ('other', 'Other')`
      }),
    )
    await register('first')
    await register('unopened')
    const initial = await runtime.runPromise(
      requestWorkspaceLayout({ action: 'read', conversationId: 'first' }),
    )
    const arranged = { ...initial.state.layout, sidebarWidths: { left: 360, right: 520 } }
    const saved = await runtime.runPromise(
      requestWorkspaceLayout({
        action: 'save',
        conversationId: 'first',
        revision: 0,
        layout: arranged,
      }),
    )
    expect(saved.state.revision).toBe(1)
    await runtime.runPromise(
      requestWorkspaceLayout({ action: 'save-default', conversationId: 'first', revision: 1 }),
    )
    await register('new')
    const stale = await runtime.runPromise(
      requestWorkspaceLayout({
        action: 'save',
        conversationId: 'first',
        revision: 0,
        layout: initial.state.layout,
      }),
    )
    expect(stale).toEqual({ status: 'conflict', state: saved.state })
    await runtime.runPromise(
      requestWorkspaceLayout({
        action: 'operate',
        conversationId: 'first',
        revision: 1,
        operation: { type: 'sidebar-width', side: 'left', width: 420 },
      }),
    )
    await runtime.runPromise(moveWorkspaceChat('new', 'other'))
    await runtime.dispose()
    runtime = makeChatStateDatabaseRuntime(filename)
    const read = (conversationId: string) =>
      runtime.runPromise(requestWorkspaceLayout({ action: 'read', conversationId }))
    expect((await read('new')).state).toMatchObject({ workspaceId: 'other', layout: arranged })
    expect((await read('unopened')).state.layout).toEqual(initial.state.layout)
    expect((await read('first')).state.layout.sidebarWidths.left).toBe(420)
    await expect(read('missing')).rejects.toThrow('Conversation not found.')
    await expect(
      runtime.runPromise(
        requestWorkspaceLayout({
          action: 'operate',
          conversationId: 'first',
          revision: 2,
          operation: { type: 'focus', id: 'missing-panel' },
        }),
      ),
    ).rejects.toThrow()
    expect((await read('first')).state.revision).toBe(2)
  } finally {
    await runtime.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
