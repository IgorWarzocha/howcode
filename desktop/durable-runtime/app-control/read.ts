import type { Context, JsonValue } from '@earendil-works/chord'
import type { Conversation, Cursor, EntryRecord } from '@earendil-works/pi-durable'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import type { AppControlResult } from '../../../shared/app-control.ts'
import { decodeEntryId } from '../identity.ts'

const ReadCursor = Schema.Struct({
  scan: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  head: Schema.optionalKey(Schema.String),
})

function mutableJson(value: Schema.Json): JsonValue {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(mutableJson)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mutableJson(item)]))
}

function entryText(entry: EntryRecord) {
  return (entry.model ?? [])
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content
            .map((block) => {
              if (block.type === 'text') return block.text
              if (block.type === 'toolCall')
                return `${block.name}(${JSON.stringify(block.arguments)})`
              return `[${block.type}]`
            })
            .join('\n'),
    )
    .join('\n')
}

async function decodeCursor(token: string | undefined) {
  if (!token) return { scan: undefined, offset: 0, head: undefined }
  try {
    const decoded = await Effect.runPromise(
      Schema.decodeUnknownEffect(ReadCursor)(JSON.parse(token), { onExcessProperty: 'error' }),
    )
    return {
      scan: decoded.scan
        ? Object.fromEntries(
            Object.entries(decoded.scan).map(([key, value]) => [key, mutableJson(value)]),
          )
        : undefined,
      offset: decoded.offset,
      head: decoded.head,
    }
  } catch {
    throw new Error(
      'Invalid read cursor. Pass nextCursor from chats.read unchanged, or omit cursor to restart.',
    )
  }
}

export async function readChat(
  conversation: Conversation,
  token: string | undefined,
  limit: number,
  context: Context,
): Promise<AppControlResult> {
  const decoded = await decodeCursor(token)
  let scan: Cursor | undefined = decoded.scan
  let offset = decoded.offset
  let head = decoded.head
  const items: AppControlResult[] = []
  let remaining = 24000
  while (items.length < limit && remaining > 0) {
    const entries = await conversation.entries(
      head ? { maxEntryId: decodeEntryId(head) } : {},
      1,
      scan,
      context,
    )
    const entry = entries.items[0]
    if (!entry)
      return { id: String(conversation.id), items, nextCursor: null, order: 'newest-first' }
    head ??= String(entry.id)
    const text = entryText(entry)
    if (offset > text.length)
      throw new Error('Read cursor no longer matches this transcript; restart without cursor.')
    const fragment = text.slice(offset, offset + Math.min(6000, remaining))
    const truncated = offset + fragment.length < text.length
    items.push({
      id: String(entry.id),
      kind: entry.kind,
      roles: (entry.model ?? []).map((message) => message.role),
      text: fragment,
      textOffset: offset,
      truncated,
    })
    remaining -= fragment.length
    if (truncated)
      return {
        id: String(conversation.id),
        items,
        nextCursor: JSON.stringify({ scan, head, offset: offset + fragment.length }),
        order: 'newest-first',
      }
    offset = 0
    scan = entries.next
    if (scan === undefined)
      return { id: String(conversation.id), items, nextCursor: null, order: 'newest-first' }
  }
  return {
    id: String(conversation.id),
    items,
    nextCursor: JSON.stringify({ scan, head, offset: 0 }),
    order: 'newest-first',
  }
}
