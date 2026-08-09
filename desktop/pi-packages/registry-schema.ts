import * as Schema from 'effect/Schema'

const RegistryPackageLinks = Schema.Struct({
  homepage: Schema.optionalKey(Schema.Unknown),
  npm: Schema.optionalKey(Schema.Unknown),
  repository: Schema.optionalKey(Schema.Unknown),
})

const RegistryPackage = Schema.Struct({
  name: Schema.optionalKey(Schema.Unknown),
  version: Schema.optionalKey(Schema.Unknown),
  description: Schema.optionalKey(Schema.Unknown),
  keywords: Schema.optionalKey(Schema.Unknown),
  date: Schema.optionalKey(Schema.Unknown),
  links: Schema.optionalKey(RegistryPackageLinks),
})

export const RegistrySearchObject = Schema.Struct({
  downloads: Schema.optionalKey(
    Schema.Struct({
      monthly: Schema.optionalKey(Schema.Unknown),
      weekly: Schema.optionalKey(Schema.Unknown),
    }),
  ),
  searchScore: Schema.optionalKey(Schema.Unknown),
  updated: Schema.optionalKey(Schema.Unknown),
  package: Schema.optionalKey(RegistryPackage),
})
export interface RegistrySearchObject extends Schema.Schema.Type<typeof RegistrySearchObject> {}

export const RegistrySearchResponse = Schema.Struct({
  total: Schema.optionalKey(Schema.Unknown),
  objects: Schema.optionalKey(Schema.Array(RegistrySearchObject)),
})
export interface RegistrySearchResponse extends Schema.Schema.Type<typeof RegistrySearchResponse> {}
