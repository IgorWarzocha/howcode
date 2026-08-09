import type {
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type {
  GitOpsMode,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
} from './desktop-project-git-contracts'
import type { PiSettingsSchema, PiThemeStateSchema } from './desktop-settings-schema'
import type { Project } from './desktop-thread-contracts'
import type { ComposerSendMode, KeybindingOverrides } from './keybindings'

export type ModelSelection = {
  provider: string
  id: string
}

export type ProjectDeletionMode = 'pi-only' | 'full-clean'
export type { GitOpsMode } from './desktop-project-git-contracts'

export type AppSettings = {
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
  projectImportState: boolean | null
  preferredProjectLocation: string | null
  customPiDirectory: string | null
  initializeGitOnProjectCreate: boolean
  projectDashboardEnabled: boolean
  gitOpsDefaultMode: GitOpsMode
  gitDiffBaselineDefault: ProjectDiffDefaultBaseline
  gitDiffRenderModeDefault: ProjectDiffRenderMode
  gitDiffFileTreeDefaultVisible: boolean
  gitDiffIncludeUntrackedDefault: boolean
  projectDeletionMode: ProjectDeletionMode
  useAgentsSkillsPaths: boolean
  devUpdateBranch: boolean
  piTuiTakeover: boolean
  hideSidebarSessionCounts: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  keybindings: KeybindingOverrides
  composerSendMode: ComposerSendMode
}

export type PiTransportMode = 'sse' | 'websocket' | 'auto'
export type PiQueueMode = 'all' | 'one-at-a-time'
export type PiDoubleEscapeAction = 'fork' | 'tree' | 'none'
export type PiTreeFilterMode = 'default' | 'no-tools' | 'user-only' | 'labeled-only' | 'all'
export type PiDefaultProjectTrust = 'ask' | 'always' | 'never'

export type PiSettings = typeof PiSettingsSchema.Type

export type PiThemeState = typeof PiThemeStateSchema.Type

export type ShellState = {
  platform: string
  mockMode: boolean
  productName: string
  cwd: string
  resolvedCwd?: string | undefined
  agentDir: string
  sessionDir: string
  projects: Project[]
  sidebarVisibleProjectIds: string[] | null
  appSettings: AppSettings
  piSettings: PiSettings
  piTheme: PiThemeState
  composer: ComposerState
}
