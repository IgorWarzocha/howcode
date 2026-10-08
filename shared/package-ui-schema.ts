import * as Schema from 'effect/Schema'

export const PackageUiReferenceSchema = Schema.Struct({
  id: Schema.String,
  revision: Schema.String,
})
export const PackageUiDescriptorSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    revision: Schema.String,
    name: Schema.String,
    status: Schema.Literal('ready'),
  }),
  Schema.Struct({
    id: Schema.String,
    revision: Schema.String,
    name: Schema.String,
    status: Schema.Literal('error'),
    error: Schema.String,
  }),
])
export const PackageUiCatalogSchema = Schema.mutable(Schema.Array(PackageUiDescriptorSchema))
export const PackageUiModuleSourceSchema = Schema.Struct({ js: Schema.String })

export const PackageUiSessionSchema = Schema.Struct({ sessionId: Schema.String })
export const PackageUiOpenSchema = Schema.Struct({
  id: Schema.String,
  revision: Schema.String,
  sessionId: Schema.String,
})
export const PackageUiOperationSchema = Schema.Struct({
  sessionId: Schema.String,
  operationId: Schema.String,
  kind: Schema.Literals(['call', 'stream', 'cancel']),
  name: Schema.String,
  input: Schema.Json,
})
export const PackageUiSnapshotSchema = Schema.Struct({
  sequence: Schema.Number,
  value: Schema.Json,
})
export const PackageUiBindingEventSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('snapshot'), snapshot: PackageUiSnapshotSchema }),
  Schema.Struct({ type: Schema.Literal('error'), error: Schema.String }),
  Schema.Struct({ type: Schema.Literal('value'), operationId: Schema.String, value: Schema.Json }),
  Schema.Struct({ type: Schema.Literal('end'), operationId: Schema.String }),
  Schema.Struct({
    type: Schema.Literal('operation-error'),
    operationId: Schema.String,
    error: Schema.String,
  }),
])
export const PackageUiBindingEventsSchema = Schema.mutable(
  Schema.Array(PackageUiBindingEventSchema),
)
