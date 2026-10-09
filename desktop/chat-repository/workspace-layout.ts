import {
  applyWorkspaceLayoutOperation,
  createWorkspaceLayoutSnapshot,
  parseWorkspaceLayoutOperation,
  parseWorkspaceLayoutSnapshot,
} from '@howaboua/howcode-sdk/workspace-layout-state'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import type {
  ChatWorkspaceLayout,
  WorkspaceLayoutRequest,
  WorkspaceLayoutResponse,
} from '../../shared/workspace-layout-contracts.ts'
import { decodePersistedRows } from './row-schema.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

const LayoutRow = Schema.Struct({
  workspaceId: Schema.NullOr(Schema.String),
  layout: Schema.NullOr(Schema.String),
  revision: Schema.Number,
  defaultLayout: Schema.NullOr(Schema.String),
})

export const seedWorkspaceLayouts = Effect.fn('WorkspaceLayout.seed')(function* (
  conversationId: string | null,
) {
  const sql = yield* SqlClient.SqlClient
  const empty = JSON.stringify(createWorkspaceLayoutSnapshot())
  yield* sql`UPDATE conversation_facts SET workspace_layout_json = COALESCE(
    (SELECT layout_default_json FROM chat_groups WHERE id = conversation_facts.workspace_id), ${empty})
    WHERE workspace_layout_json IS NULL AND workspace_id IS NOT NULL
    AND (${conversationId} IS NULL OR conversation_id = ${conversationId})`
})

/** A seed becomes the chat's own record on first access, never a live default reference. */
const readLayout = Effect.fn('WorkspaceLayout.read')(function* (conversationId: string) {
  const sql = yield* SqlClient.SqlClient
  const [row] = decodePersistedRows(
    LayoutRow,
    yield* sql`SELECT facts.workspace_id AS workspaceId,
      facts.workspace_layout_json AS layout, facts.workspace_layout_revision AS revision,
      groups.layout_default_json AS defaultLayout
      FROM conversation_facts facts LEFT JOIN chat_groups groups ON groups.id = facts.workspace_id
      WHERE facts.conversation_id = ${conversationId} AND facts.deleted = 0`,
    'workspace layout',
  )
  if (!row) throw new Error('Conversation not found.')
  const encoded = row.layout ?? row.defaultLayout
  const layout = encoded
    ? parseWorkspaceLayoutSnapshot(JSON.parse(encoded))
    : createWorkspaceLayoutSnapshot()
  if (row.layout === null) {
    yield* sql`UPDATE conversation_facts SET workspace_layout_json = ${JSON.stringify(layout)}
      WHERE conversation_id = ${conversationId}`
  }
  return { conversationId, workspaceId: row.workspaceId, revision: row.revision, layout }
})

function requestedLayout(state: ChatWorkspaceLayout, request: WorkspaceLayoutRequest) {
  switch (request.action) {
    case 'save':
      return parseWorkspaceLayoutSnapshot(request.layout)
    case 'operate':
      return applyWorkspaceLayoutOperation(
        state.layout,
        parseWorkspaceLayoutOperation(request.operation),
      )
    default:
      throw new Error('Unknown workspace layout mutation.')
  }
}

export const requestWorkspaceLayout = Effect.fn('WorkspaceLayout.request')(function* (
  request: WorkspaceLayoutRequest,
) {
  if (typeof request.conversationId !== 'string' || !request.conversationId)
    throw new Error('A conversation ID is required.')
  return yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const state: ChatWorkspaceLayout = yield* readLayout(request.conversationId)
      if (request.action === 'read')
        return { status: 'saved', state } satisfies WorkspaceLayoutResponse
      if (!Number.isSafeInteger(request.revision) || request.revision < 0)
        throw new Error('A valid layout revision is required.')
      if (request.revision !== state.revision)
        return { status: 'conflict', state } satisfies WorkspaceLayoutResponse
      if (request.action === 'save-default') {
        if (!state.workspaceId) throw new Error('This chat has no workspace.')
        // A new default must not retroactively change unopened existing chats.
        const empty = JSON.stringify(createWorkspaceLayoutSnapshot())
        yield* sql`UPDATE conversation_facts SET workspace_layout_json = COALESCE(
          (SELECT layout_default_json FROM chat_groups WHERE id = ${state.workspaceId}), ${empty})
          WHERE workspace_id = ${state.workspaceId} AND workspace_layout_json IS NULL`
        yield* sql`UPDATE chat_groups SET layout_default_json = ${JSON.stringify(state.layout)}
          WHERE id = ${state.workspaceId}`
        return { status: 'saved', state } satisfies WorkspaceLayoutResponse
      }
      const layout = requestedLayout(state, request)
      const revision = state.revision + 1
      yield* sql`UPDATE conversation_facts SET workspace_layout_json = ${JSON.stringify(layout)},
        workspace_layout_revision = ${revision} WHERE conversation_id = ${state.conversationId}`
      return {
        status: 'saved',
        state: { ...state, layout, revision },
      } satisfies WorkspaceLayoutResponse
    }),
  )
})
