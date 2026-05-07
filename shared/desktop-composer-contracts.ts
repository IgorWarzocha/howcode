export type ComposerThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type ComposerStreamingBehavior = 'steer' | 'followUp' | 'stop'

export type ComposerQueuedPrompt = {
  id: string
  mode: Exclude<ComposerStreamingBehavior, 'stop'>
  queueIndex: number
  queueSnapshotKey: string
  text: string
}

export type NativeAskQuestionOption = {
  label: string
  description?: string | undefined
}

export type NativeAskQuestion = {
  id: string
  question: string
  multiple?: boolean | undefined
  options: NativeAskQuestionOption[]
}

export type NativeAskQuestionsRequest = {
  id: string
  questions: NativeAskQuestion[]
}

export type ComposerModel = {
  provider: string
  id: string
  name: string
  reasoning: boolean
  input: Array<'text' | 'image'>
}

export type ComposerContextUsage = {
  tokens: number | null
  contextWindow: number
  percent: number | null
}

export type ComposerState = {
  currentModel: ComposerModel | null
  availableModels: ComposerModel[]
  currentThinkingLevel: ComposerThinkingLevel
  availableThinkingLevels: ComposerThinkingLevel[]
  queuedPrompts: ComposerQueuedPrompt[]
  nativeAskQuestionsRequest: NativeAskQuestionsRequest | null
  contextUsage: ComposerContextUsage | null
  isCompacting: boolean
  isExtensionCommandRunning: boolean
}

export type ComposerAttachment = {
  path: string
  name: string
  kind: 'directory' | 'text' | 'image'
}

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
}

export type ComposerSlashCommandSource = 'app' | 'builtin' | 'extension' | 'prompt' | 'skill'

export type ComposerSlashCommand = {
  name: string
  description?: string | undefined
  source: ComposerSlashCommandSource
  sourceInfo?: unknown | undefined
}

export type ComposerSkillReference = {
  name: string
  description: string
  filePath: string
  sourceInfo?: unknown | undefined
}
