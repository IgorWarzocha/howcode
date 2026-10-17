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
import type { PiThemeStateSchema, ShellPreferencesSchema } from './desktop-settings-schema'
import type { ComposerSendMode, KeybindingOverrides } from './keybindings'
import type { Person } from './people'
import type { ToolkitComponentId } from './toolkit-components'

export type ModelSelection = {
  provider: string
  id: string
}

export type DirectoryDeletionMode = 'pi-only' | 'full-clean'
export type { GitOpsMode } from '@howaboua/howcode-git/contracts'

export type AppSettings = {
  people: readonly Person[]
  navigationRenderer?: string
  enabledToolkitComponents?: readonly ToolkitComponentId[]
  defaultModel: ModelSelection | null
  defaultThinkingLevel: ComposerThinkingLevel | null
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

export type ShellTransportMode = 'sse' | 'websocket' | 'websocket-cached' | 'auto'
export type ShellQueueMode = 'all' | 'one-at-a-time'

export type ShellPreferences = typeof ShellPreferencesSchema.Type

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
  shellPreferences: ShellPreferences
  piTheme: PiThemeState
  composer: ComposerState
}
