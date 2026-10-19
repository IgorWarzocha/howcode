import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

const text = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(1000))
const page = {
  cursor: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\d+$/))),
  limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 }))),
}
const target = { workspace: text, chat: text }
const actions = Schema.Union([
  Schema.Struct({ action: Schema.Literal('help') }),
  Schema.Struct({ action: Schema.Literal('workspaces.list'), ...page }),
  Schema.Struct({ action: Schema.Literal('workspaces.create'), name: text }),
  Schema.Struct({ action: Schema.Literal('chats.list'), workspace: text, ...page }),
  Schema.Struct({
    action: Schema.Literal('chats.create'),
    workspace: text,
    name: Schema.optionalKey(text),
  }),
  Schema.Struct({
    action: Schema.Literal('chats.read'),
    ...target,
    ...page,
    cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(4000))),
  }),
  Schema.Struct({
    action: Schema.Literal('chats.status'),
    ...target,
    requestId: Schema.optionalKey(text),
  }),
  Schema.Struct({
    action: Schema.Literal('chats.send'),
    ...target,
    requestId: text,
    message: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(32000)),
  }),
  Schema.Struct({ action: Schema.Literal('chats.stop'), ...target }),
])

export type AppControlInput = typeof actions.Type

export const appControlHelp = {
  actions: [
    'workspaces.list(cursor?, limit?)',
    'workspaces.create(name) — logical workspace; no directory creation',
    'chats.list(workspace, cursor?, limit?)',
    'chats.create(workspace, name?)',
    'chats.read(workspace, chat, cursor?, limit?)',
    'chats.send(workspace, chat, message, requestId) — admission only; reuse requestId on retry',
    'chats.status(workspace, chat, requestId?)',
    'chats.stop(workspace, chat)',
  ],
  targeting:
    'Use returned IDs or exact unambiguous names. General includes unassigned chats. workspaceAgent identifies a workspace main chat when available.',
  continuation:
    'Pass nextCursor unchanged to the same list/read action. Read returns bounded transcript entries; status with requestId returns the actual submission outcome.',
}

export async function decodeAppControlInput(input: unknown) {
  const normalized =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? { action: 'help', ...input }
      : input
  if (
    typeof normalized === 'object' &&
    normalized !== null &&
    'action' in normalized &&
    typeof normalized.action === 'string' &&
    !['workspaces.list', 'chats.list', 'chats.read'].includes(normalized.action)
  ) {
    // Pagination hints cannot change the target or effect of an unpaginated action.
    if ('cursor' in normalized) delete normalized.cursor
    if ('limit' in normalized) delete normalized.limit
  }
  try {
    return await Effect.runPromise(
      Schema.decodeUnknownEffect(actions)(normalized, { onExcessProperty: 'error' }),
    )
  } catch (error) {
    const detail = String(error)
    if (detail.includes('Expected { readonly "action"'))
      throw new Error('Unknown Howcode action. Call {} for action signatures.')
    throw new Error(
      `Invalid Howcode input. Call {} for action signatures. ${detail.slice(0, 1200)}`,
    )
  }
}
