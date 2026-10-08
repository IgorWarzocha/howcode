import type {
  DirectoryDiffDefaultBaseline,
  DirectoryDiffRenderMode,
  GitOpsMode,
} from '@howaboua/howcode-git/contracts'
import type { WorkingDirectory } from './desktop-chat-contracts'
import type {
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type { PiSettingsSchema, PiThemeStateSchema } from './desktop-settings-schema'
import type { ComposerSendMode, KeybindingOverrides } from './keybindings'
import type { ToolkitComponentId } from './toolkit-components'

export type ModelSelection = {
  provider: string
  id: string
}

export type DirectoryDeletionMode = 'pi-only' | 'full-clean'
export type { GitOpsMode } from '@howaboua/howcode-git/contracts'

export type AppSettings = {
  enabledToolkitComponents?: readonly ToolkitComponentId[]
  chatModel: ModelSelection | null
  chatThinkingLevel: ComposerThinkingLevel | null
  codeModel: ModelSelection | null
  codeThinkingLevel: ComposerThinkingLevel | null
  gitCommitMessageModel: ModelSelection | null
  gitCommitMessageThinkingLevel: ComposerThinkingLevel
  composerStreamingBehavior: ComposerStreamingBehavior
  dictationModelId: DictationModelId | null
  dictationMaxDurationSeconds: number
  showDictationButton: boolean
  favoriteFolders: string[]
  directoryImportState: boolean | null
  preferredDirectoryLocation: string | null
  customPiDirectory: string | null
  initializeGitOnDirectoryCreate: boolean
  directoryDashboardEnabled: boolean
  gitOpsDefaultMode: GitOpsMode
  gitDiffBaselineDefault: DirectoryDiffDefaultBaseline
  gitDiffRenderModeDefault: DirectoryDiffRenderMode
  gitDiffFileTreeDefaultVisible: boolean
  gitDiffIncludeUntrackedDefault: boolean
  directoryDeletionMode: DirectoryDeletionMode
  useAgentsSkillsPaths: boolean
  hideSidebarSessionCounts: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  keybindings: KeybindingOverrides
  composerSendMode: ComposerSendMode
}

export type PiTransportMode = 'sse' | 'websocket' | 'websocket-cached' | 'auto'
export type PiQueueMode = 'all' | 'one-at-a-time'

export type PiSettings = typeof PiSettingsSchema.Type

export type PiThemeState = typeof PiThemeStateSchema.Type

export type ShellState = {
  platform: string
  mockMode: boolean
  productName: string
  cwd: string
  resolvedCwd?: string | undefined
  agentDir: string
  directories: WorkingDirectory[]
  sidebarVisibleDirectoryIds: string[] | null
  appSettings: AppSettings
  piSettings: PiSettings
  piTheme: PiThemeState
  composer: ComposerState
}
