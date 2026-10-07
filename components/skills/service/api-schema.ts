import * as Schema from 'effect/Schema'

export const SkillSearchApiItem = Schema.Struct({
  id: Schema.optionalKey(Schema.Unknown),
  skillId: Schema.optionalKey(Schema.Unknown),
  name: Schema.optionalKey(Schema.Unknown),
  installs: Schema.optionalKey(Schema.Unknown),
  source: Schema.optionalKey(Schema.Unknown),
})
export interface SkillSearchApiItem extends Schema.Schema.Type<typeof SkillSearchApiItem> {}

export const SkillSearchApiResponse = Schema.Struct({
  query: Schema.optionalKey(Schema.Unknown),
  count: Schema.optionalKey(Schema.Unknown),
  skills: Schema.optionalKey(Schema.Array(SkillSearchApiItem)),
})
export interface SkillSearchApiResponse extends Schema.Schema.Type<typeof SkillSearchApiResponse> {}

export const SkillDownloadApiFile = Schema.Struct({
  path: Schema.optionalKey(Schema.Unknown),
  contents: Schema.optionalKey(Schema.Unknown),
})
export interface SkillDownloadApiFile extends Schema.Schema.Type<typeof SkillDownloadApiFile> {}

export const SkillDownloadApiResponse = Schema.Struct({
  files: Schema.optionalKey(Schema.Array(SkillDownloadApiFile)),
  hash: Schema.optionalKey(Schema.Unknown),
})
export interface SkillDownloadApiResponse
  extends Schema.Schema.Type<typeof SkillDownloadApiResponse> {}
