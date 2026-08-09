import * as Schema from 'effect/Schema'

export const SessionTreeListRowSchema = Schema.Struct({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  depth: Schema.Number,
  label: Schema.String,
  customLabel: Schema.optionalKey(Schema.String),
  meta: Schema.optionalKey(Schema.String),
  kind: Schema.Literals(['user', 'assistant', 'tool', 'branch', 'summary', 'system', 'other']),
  isLeaf: Schema.Boolean,
  isOnActivePath: Schema.Boolean,
  assistantToolOnly: Schema.optionalKey(Schema.Boolean),
})

export const SessionTreeListSchema = Schema.Struct({
  leafId: Schema.NullOr(Schema.String),
  rows: Schema.mutable(Schema.Array(SessionTreeListRowSchema)),
})
