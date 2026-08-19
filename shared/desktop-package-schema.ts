import * as Schema from 'effect/Schema'

export const PiConfiguredPackageSchema = Schema.Struct({
  resourceKind: Schema.Literals(['package', 'extension']),
  source: Schema.String,
  identityKey: Schema.String,
  displayName: Schema.String,
  type: Schema.Literals(['npm', 'git', 'local']),
  scope: Schema.Literals(['user', 'project', 'chat']),
  filtered: Schema.Boolean,
  installedPath: Schema.NullOr(Schema.String),
  settingsPath: Schema.NullOr(Schema.String),
})

export const PiPackageMutationResultSchema = Schema.Struct({
  source: Schema.String,
  normalizedSource: Schema.String,
  configuredPackages: Schema.mutable(Schema.Array(PiConfiguredPackageSchema)),
})

export const PiConfiguredSkillSchema = Schema.Struct({
  source: Schema.String,
  identityKey: Schema.String,
  displayName: Schema.String,
  description: Schema.NullOr(Schema.String),
  scope: Schema.Literals(['user', 'project', 'chat']),
  provenance: Schema.Literals(['skills.sh', 'local']),
  installedPath: Schema.String,
  skillFilePath: Schema.String,
  sourceRepo: Schema.NullOr(Schema.String),
  sourceUrl: Schema.NullOr(Schema.String),
})

export const PiSkillMutationResultSchema = Schema.Struct({
  source: Schema.String,
  normalizedSource: Schema.String,
  configuredSkills: Schema.mutable(Schema.Array(PiConfiguredSkillSchema)),
})
