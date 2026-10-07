import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'

export const ThreadRowSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  conversationId: Schema.String,
  summary: Schema.NullOr(Schema.String),
  running: Schema.Number,
  unread: Schema.Number,
  pinned: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  lastModifiedMs: Schema.Number,
})

export const InboxThreadRowSchema = Schema.Struct({
  threadId: Schema.String,
  title: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  conversationId: Schema.String,
  lastAssistantPreview: Schema.NullOr(Schema.String),
  running: Schema.Number,
  unread: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  lastActivityMs: Schema.Number,
  isChat: Schema.Number,
})

export const ArchivedThreadRowSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  conversationId: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  lastModifiedMs: Schema.Number,
  isChat: Schema.Number,
})

export function decodePersistedRow<A>(
  schema: Schema.ConstraintDecoder<A>,
  row: unknown,
  label: string,
) {
  const decoded = Schema.decodeUnknownResult(schema)(row)
  if (Result.isFailure(decoded)) {
    throw new Error(`Invalid persisted ${label} row: ${decoded.failure}`)
  }
  return decoded.success
}

export function decodePersistedRows<A>(
  schema: Schema.ConstraintDecoder<A>,
  rows: readonly unknown[],
  label: string,
) {
  return rows.map((row) => decodePersistedRow(schema, row, label))
}
