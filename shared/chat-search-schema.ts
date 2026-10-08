import * as Schema from 'effect/Schema'

export const ChatSearchMatchSchema = Schema.Struct({
  messageId: Schema.String,
  messageIndex: Schema.Number,
  revealHistoryCompactions: Schema.optionalKey(Schema.Number),
  role: Schema.Literals([
    'user',
    'assistant',
    'toolResult',
    'bashExecution',
    'custom',
    'system',
    'branchSummary',
    'compactionSummary',
  ]),
  snippet: Schema.String,
  matchStart: Schema.Number,
  matchEnd: Schema.Number,
})

export const ChatSearchResultSchema = Schema.Struct({
  matches: Schema.mutable(Schema.Array(ChatSearchMatchSchema)),
  searchedMessageCount: Schema.Number,
})
