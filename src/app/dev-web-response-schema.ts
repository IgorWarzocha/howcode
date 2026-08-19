import { ComposerAttachmentSchema } from '@howcode/shared/desktop-composer-schema'
import * as Schema from 'effect/Schema'

export const HeadlessAuthStateSchema = Schema.Struct({
  authenticated: Schema.optionalKey(Schema.Boolean),
  required: Schema.optionalKey(Schema.Boolean),
})

export const HeadlessBridgeConfigSchema = Schema.Struct({
  bridgeToken: Schema.optionalKey(Schema.String),
})

export const HeadlessErrorResponseSchema = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
})

export const ComposerAttachmentUploadResponseSchema = Schema.Struct({
  attachments: Schema.optionalKey(Schema.mutable(Schema.Array(ComposerAttachmentSchema))),
})
