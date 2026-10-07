import * as Schema from 'effect/Schema'
import { composerThinkingLevels } from './composer-thinking-level'

export const ComposerThinkingLevelSchema = Schema.Literals(composerThinkingLevels)

export const ComposerStreamingBehaviorSchema = Schema.Literals(['steer', 'followUp', 'stop'])

export const ComposerQueuedPromptSchema = Schema.Struct({
  id: Schema.String,
  mode: Schema.Literals(['steer', 'followUp']),
  text: Schema.String,
})

export const ComposerModelSchema = Schema.Struct({
  provider: Schema.String,
  id: Schema.String,
  name: Schema.String,
  reasoning: Schema.Boolean,
  input: Schema.mutable(Schema.Array(Schema.Literals(['text', 'image']))),
})

export const ComposerStateSchema = Schema.Struct({
  currentModel: Schema.NullOr(ComposerModelSchema),
  availableModels: Schema.mutable(Schema.Array(ComposerModelSchema)),
  currentThinkingLevel: ComposerThinkingLevelSchema,
  availableThinkingLevels: Schema.mutable(Schema.Array(ComposerThinkingLevelSchema)),
  queuedPrompts: Schema.mutable(Schema.Array(ComposerQueuedPromptSchema)),
  contextUsage: Schema.NullOr(
    Schema.Struct({
      tokens: Schema.NullOr(Schema.Number),
      contextWindow: Schema.Number,
      percent: Schema.NullOr(Schema.Number),
      latestCacheHitRate: Schema.NullOr(Schema.Number),
    }),
  ),
  isCompacting: Schema.Boolean,
})

export const ComposerAttachmentSchema = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(['directory', 'text', 'image']),
})

export const ComposerSlashCommandSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  source: Schema.Literals(['app', 'builtin', 'prompt', 'skill']),
  sourceInfo: Schema.optionalKey(Schema.Unknown),
})

export const ComposerSkillReferenceSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  filePath: Schema.String,
  sourceInfo: Schema.optionalKey(Schema.Unknown),
})
