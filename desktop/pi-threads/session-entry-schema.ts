import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'

const MessageContentBlockSchema = Schema.Struct({
  type: Schema.optionalKey(Schema.String),
  text: Schema.optionalKey(Schema.String),
})

const UsageSchema = Schema.Struct({
  input: Schema.optionalKey(Schema.Number),
  output: Schema.optionalKey(Schema.Number),
  cacheRead: Schema.optionalKey(Schema.Number),
  cacheWrite: Schema.optionalKey(Schema.Number),
  totalTokens: Schema.optionalKey(Schema.Number),
  cost: Schema.optionalKey(Schema.Struct({ total: Schema.optionalKey(Schema.Number) })),
})

export const SessionFileEntrySchema = Schema.Struct({
  type: Schema.optionalKey(Schema.String),
  id: Schema.optionalKey(Schema.String),
  timestamp: Schema.optionalKey(Schema.String),
  cwd: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(
    Schema.Struct({
      role: Schema.optionalKey(Schema.String),
      timestamp: Schema.optionalKey(Schema.Number),
      content: Schema.optionalKey(
        Schema.Union([Schema.String, Schema.Array(MessageContentBlockSchema)]),
      ),
      usage: Schema.optionalKey(UsageSchema),
    }),
  ),
  name: Schema.optionalKey(Schema.String),
})

export type SessionFileEntry = typeof SessionFileEntrySchema.Type

const decodeSessionFileEntry = Schema.decodeUnknownResult(SessionFileEntrySchema)

export function decodeSessionFileLine(line: string) {
  if (!line.trim()) return null
  try {
    const decoded = decodeSessionFileEntry(JSON.parse(line))
    return Result.isSuccess(decoded) ? decoded.success : null
  } catch {
    return null
  }
}
