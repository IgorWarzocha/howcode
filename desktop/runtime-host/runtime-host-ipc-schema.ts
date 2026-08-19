import * as Schema from 'effect/Schema'
import { DesktopEventSchema } from '../../shared/desktop-event-schema.ts'

const RuntimeHostResponseMessageSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('response'),
    id: Schema.String,
    ok: Schema.Literal(true),
    result: Schema.Unknown,
  }),
  Schema.Struct({
    type: Schema.Literal('response'),
    id: Schema.String,
    ok: Schema.Literal(false),
    error: Schema.String,
    stack: Schema.optionalKey(Schema.String),
  }),
])

export const RuntimeHostToMainMessageSchema = Schema.Union([
  RuntimeHostResponseMessageSchema,
  Schema.Struct({ type: Schema.Literal('desktop-event'), event: DesktopEventSchema }),
  Schema.Struct({
    type: Schema.Literal('host-error'),
    error: Schema.String,
    stack: Schema.optionalKey(Schema.String),
  }),
])

export type RuntimeHostToMainMessage = typeof RuntimeHostToMainMessageSchema.Type
