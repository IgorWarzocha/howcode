import * as Schema from 'effect/Schema'
import { composerThinkingLevels } from './composer-thinking-level'

export const ComposerThinkingLevelSchema = Schema.Literals(composerThinkingLevels)

export const ComposerStreamingBehaviorSchema = Schema.Literals(['steer', 'followUp', 'stop'])

export const ComposerQueuedPromptSchema = Schema.Struct({
  id: Schema.String,
  mode: Schema.Literals(['steer', 'followUp']),
  queueIndex: Schema.Number,
  queueSnapshotKey: Schema.String,
  text: Schema.String,
})

export const PiExtensionWidgetSchema = Schema.Struct({
  key: Schema.String,
  lines: Schema.mutable(Schema.Array(Schema.String)),
  placement: Schema.optionalKey(Schema.Literals(['aboveEditor', 'belowEditor', 'status'])),
})

export const PiExtensionStatusSchema = Schema.Struct({ key: Schema.String, text: Schema.String })

export const PiExtensionShortcutSchema = Schema.Struct({
  shortcut: Schema.String,
  description: Schema.optionalKey(Schema.String),
  extensionPath: Schema.String,
})

export const PiExtensionDialogRequestSchema = Schema.Struct({
  id: Schema.String,
  method: Schema.Literals(['select', 'confirm', 'input', 'editor']),
  title: Schema.String,
  message: Schema.optionalKey(Schema.String),
  options: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  placeholder: Schema.optionalKey(Schema.String),
  prefill: Schema.optionalKey(Schema.String),
})

export const PiExtensionUiStateSchema = Schema.Struct({
  piExtensionWidgets: Schema.mutable(Schema.Array(PiExtensionWidgetSchema)),
  piExtensionStatuses: Schema.mutable(Schema.Array(PiExtensionStatusSchema)),
  piExtensionDialogRequest: Schema.NullOr(PiExtensionDialogRequestSchema),
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
  piExtensionWidgets: PiExtensionUiStateSchema.fields.piExtensionWidgets,
  piExtensionStatuses: PiExtensionUiStateSchema.fields.piExtensionStatuses,
  piExtensionShortcuts: Schema.mutable(Schema.Array(PiExtensionShortcutSchema)),
  piExtensionDialogRequest: PiExtensionUiStateSchema.fields.piExtensionDialogRequest,
  projectTrustRequest: Schema.NullOr(Schema.Struct({ cwd: Schema.String })),
  contextUsage: Schema.NullOr(
    Schema.Struct({
      tokens: Schema.NullOr(Schema.Number),
      contextWindow: Schema.Number,
      percent: Schema.NullOr(Schema.Number),
      latestCacheHitRate: Schema.NullOr(Schema.Number),
    }),
  ),
  isCompacting: Schema.Boolean,
  isExtensionCommandRunning: Schema.Boolean,
})

export const ComposerAttachmentSchema = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(['directory', 'text', 'image']),
})

export const ComposerSlashCommandSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  source: Schema.Literals(['app', 'builtin', 'extension', 'prompt', 'skill']),
  sourceInfo: Schema.optionalKey(Schema.Unknown),
})

export const ComposerSkillReferenceSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  filePath: Schema.String,
  sourceInfo: Schema.optionalKey(Schema.Unknown),
})
