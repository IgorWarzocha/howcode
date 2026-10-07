import * as Schema from 'effect/Schema'

export const PackageUiReferenceSchema = Schema.Struct({
  id: Schema.String,
  revision: Schema.String,
})
export const PackageUiRpcRequestSchema = Schema.Struct({
  id: Schema.String,
  revision: Schema.String,
  method: Schema.String,
  input: Schema.Json,
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
