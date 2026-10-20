import { InputOriginSchema, InputSemanticsSchema } from '@howaboua/howcode-sdk/input-delivery'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

const identity = Schema.String.check(Schema.isMinLength(1))

export type { InputOrigin, InputSemantics } from '@howaboua/howcode-sdk/input-delivery'
export { InputOriginSchema, InputSemanticsSchema }
export const trustedInputKind = 'howcode.input'

export const TrustedInputDataSchema = Schema.Struct({
  origin: InputOriginSchema,
  semantics: Schema.optionalKey(InputSemanticsSchema),
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
