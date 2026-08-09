import type {
  ComposerAttachmentSchema,
  ComposerModelSchema,
  ComposerQueuedPromptSchema,
  ComposerSkillReferenceSchema,
  ComposerSlashCommandSchema,
  ComposerStateSchema,
  ComposerStreamingBehaviorSchema,
  ComposerThinkingLevelSchema,
  PiExtensionDialogRequestSchema,
  PiExtensionShortcutSchema,
  PiExtensionStatusSchema,
  PiExtensionUiStateSchema,
  PiExtensionWidgetSchema,
} from './desktop-composer-schema'

export type ComposerThinkingLevel = typeof ComposerThinkingLevelSchema.Type
export type ComposerStreamingBehavior = typeof ComposerStreamingBehaviorSchema.Type
export type ComposerQueuedPrompt = typeof ComposerQueuedPromptSchema.Type
export type PiExtensionWidget = typeof PiExtensionWidgetSchema.Type
export type PiExtensionStatus = typeof PiExtensionStatusSchema.Type
export type PiExtensionShortcut = typeof PiExtensionShortcutSchema.Type
export type PiExtensionDialogRequest = typeof PiExtensionDialogRequestSchema.Type
export type PiExtensionUiState = typeof PiExtensionUiStateSchema.Type
export type ComposerModel = typeof ComposerModelSchema.Type
export type ComposerState = typeof ComposerStateSchema.Type
export type ComposerAttachment = typeof ComposerAttachmentSchema.Type

export type ProjectTrustRequest = NonNullable<ComposerState['projectTrustRequest']>
export type ComposerContextUsage = NonNullable<ComposerState['contextUsage']>

export type ComposerFilePickerEntry = {
  path: string
  name: string
  kind: 'directory' | 'text' | 'image'
}

export type ComposerFilePickerState = {
  homePath: string
  rootPath: string
  currentPath: string
  parentPath: string | null
  entries: ComposerFilePickerEntry[]
}

export type ComposerFileSearchEntry = ComposerFilePickerEntry & {
  relativePath: string
}

export type ComposerStateRequest = {
  projectId?: string | undefined | null | undefined
  sessionPath?: string | undefined | null | undefined
  composerMode?: 'chat' | 'code' | null | undefined
  composerModelSelection?: { provider: string | undefined; id: string } | null
  composerUseDefaultModel?: boolean | undefined
  composerThinkingLevel?: ComposerThinkingLevel | null | undefined
  composerStreamingBehavior?: ComposerStreamingBehavior | null | undefined
  composerSessionDir?: string | undefined | null | undefined
  chatGroupId?: string | undefined | null | undefined
  branchName?: string | undefined | null | undefined
}

export type ComposerSlashCommand = typeof ComposerSlashCommandSchema.Type
export type ComposerSlashCommandSource = ComposerSlashCommand['source']
export type ComposerSkillReference = typeof ComposerSkillReferenceSchema.Type
