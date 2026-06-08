import type {
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type {
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
} from './desktop-project-git-contracts'
import type { Project } from './desktop-thread-contracts'
import type { ComposerSendMode, KeybindingOverrides } from './keybindings'

export type ModelSelection = {
  provider: string
  id: string
}

export type ProjectDeletionMode = 'pi-only' | 'full-clean'
export type GitOpsMode = 'commit' | 'commit-push'

export type AppSettings = {
  chatModel: ModelSelection | null
  chatThinkingLevel: ComposerThinkingLevel | null
  codeModel: ModelSelection | null
  codeThinkingLevel: ComposerThinkingLevel | null
  gitCommitMessageModel: ModelSelection | null
  gitCommitMessageThinkingLevel: ComposerThinkingLevel
  skillCreatorModel: ModelSelection | null
  skillCreatorThinkingLevel: ComposerThinkingLevel
  smartBtwModel: ModelSelection | null
  smartBtwThinkingLevel: ComposerThinkingLevel
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
  howcodeNativeAskQuestions: boolean
  howcodeNativeSmartBtw: boolean
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

export type PiSettings = {
  extensions: string[]
  theme: string
  autoCompact: boolean
  enableSkillCommands: boolean
  hideThinkingBlock: boolean
  quietStartup: boolean
  showImages: boolean
  autoResizeImages: boolean
  blockImages: boolean
  collapseChangelog: boolean
  enableInstallTelemetry: boolean
  showHardwareCursor: boolean
  clearOnShrink: boolean
  transport: PiTransportMode
  steeringMode: PiQueueMode
  followUpMode: PiQueueMode
  doubleEscapeAction: PiDoubleEscapeAction
  treeFilterMode: PiTreeFilterMode
  editorPaddingX: number
  autocompleteMaxVisible: number
  imageWidthCells: number
}

export type PiThemeState = {
  selectedTheme: string
  themes: Array<{
    name: string
    label: string
    source: 'howcode' | 'pi-builtin' | 'pi-json'
    path?: string | undefined
  }>
  colors: Record<string, string> &
    Partial<
      Record<
        | 'toolPendingBg'
        | 'userMessageBg'
        | 'text'
        | 'muted'
        | 'dim'
        | 'accent'
        | 'selectedBg'
        | 'success'
        | 'error'
        | 'warning'
        | 'customMessageBg'
        | 'mdCodeBlock'
        | 'mdHeading'
        | 'mdLink'
        | 'mdCode'
        | 'mdQuote',
        string
      >
    >
  exportColors: {
    pageBg?: string | undefined
    cardBg?: string | undefined
    infoBg?: string | undefined
  }
  isLight: boolean
  diagnostics: Array<{ type: string; message: string; path?: string | undefined }>
}

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
