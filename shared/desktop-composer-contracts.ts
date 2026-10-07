import type {
  ComposerAttachmentSchema,
  ComposerExtensionSelectionSchema,
  ComposerModelSchema,
  ComposerQueuedPromptSchema,
  ComposerSkillReferenceSchema,
  ComposerSlashCommandSchema,
  ComposerStateSchema,
  ComposerStreamingBehaviorSchema,
  ComposerThinkingLevelSchema,
} from './desktop-composer-schema'

export type ComposerThinkingLevel = typeof ComposerThinkingLevelSchema.Type
export type ComposerStreamingBehavior = typeof ComposerStreamingBehaviorSchema.Type
export type ComposerQueuedPrompt = typeof ComposerQueuedPromptSchema.Type
export type ComposerModel = typeof ComposerModelSchema.Type
export type ComposerState = typeof ComposerStateSchema.Type
export type ComposerAttachment = typeof ComposerAttachmentSchema.Type
export type ComposerExtensionSelection = typeof ComposerExtensionSelectionSchema.Type

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
  /** Omitted uses compatibility defaults. An empty array selects no extensions. */
  composerExtensions?: ComposerExtensionSelection | undefined
  projectId?: string | undefined | null | undefined
  conversationId?: string | undefined | null | undefined
  composerMode?: 'chat' | 'code' | null | undefined
  composerModelSelection?: { provider: string | undefined; id: string } | null
  composerUseDefaultModel?: boolean | undefined
  composerThinkingLevel?: ComposerThinkingLevel | null | undefined
  composerStreamingBehavior?: ComposerStreamingBehavior | null | undefined
  chatGroupId?: string | undefined | null | undefined
  branchName?: string | undefined | null | undefined
}

export type ComposerSlashCommand = typeof ComposerSlashCommandSchema.Type
export type ComposerSlashCommandSource = ComposerSlashCommand['source']
export type ComposerSkillReference = typeof ComposerSkillReferenceSchema.Type
