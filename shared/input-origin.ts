import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

const identity = Schema.String.check(Schema.isMinLength(1))

export const InputOriginSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('human-composer') }),
  Schema.Struct({
    kind: Schema.Literal('human-action'),
    action: Schema.Literals(['assistant-setup', 'component-request']),
  }),
  Schema.Struct({
    kind: Schema.Literal('agent'),
    conversationId: identity,
    taskId: Schema.optionalKey(identity),
  }),
  Schema.Struct({ kind: Schema.Literal('mcp') }),
  Schema.Struct({ kind: Schema.Literal('scheduled'), source: identity }),
])

export type InputOrigin = typeof InputOriginSchema.Type
export const trustedInputKind = 'howcode.input'

export const TrustedInputDataSchema = Schema.Struct({
  origin: InputOriginSchema,
  at: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  inputEntry: Schema.optionalKey(
    Schema.Struct({ kind: identity, data: Schema.optionalKey(Schema.Json) }),
  ),
})

/** Missing attribution in older entries is unknown, never inferred from the model's user role. */
export function readTrustedInputData(entry: { kind: string; data?: unknown }) {
  if (entry.kind !== trustedInputKind) return null
  return Option.getOrNull(Schema.decodeUnknownOption(TrustedInputDataSchema)(entry.data))
}
