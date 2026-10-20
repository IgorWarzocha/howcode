import * as Schema from 'effect/Schema'
import { readTrustedInputData } from './input-origin'

export const PersonSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  description: Schema.String.check(Schema.isMaxLength(200)),
})
export type Person = typeof PersonSchema.Type
export const PeopleSchema = Schema.Array(PersonSchema)
export const PeopleUpdateSchema = Schema.Union([
  Schema.Struct({
    operation: Schema.Literal('upsert'),
    person: Schema.Struct({
      id: Schema.optionalKey(PersonSchema.fields.id),
      name: PersonSchema.fields.name,
      description: PersonSchema.fields.description,
    }),
  }),
  Schema.Struct({ operation: Schema.Literal('remove'), id: Schema.String }),
])
export type PeopleUpdate = typeof PeopleUpdateSchema.Type

export const personInputKind = 'howcode.person-input'

export function getPersonInputData(entry: { kind: string; data?: unknown }) {
  const input = readTrustedInputData(entry)?.inputEntry ?? entry
  if (input.kind !== personInputKind) return undefined
  return Schema.decodeUnknownSync(
    Schema.Struct({
      author: PersonSchema,
      modelContextBlocks: Schema.Literal(1),
    }),
  )(input.data)
}
