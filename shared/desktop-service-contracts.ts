import type { ConversationEntryList } from './conversation-entries'
import type { DesktopAction } from './desktop-actions'
import type {
  AnyDesktopActionPayload,
  AppSettings,
  ArchivedChat,
  Artifact,
  ArtifactVersion,
  Chat,
  ChatData,
  ChatSearchResult,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResultData,
  DesktopEvent,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
  DirectoryCommitEntry,
  DirectoryDiffBaseline,
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
  DirectoryDiffImagePreview,
  DirectoryDiffImageSide,
  DirectoryDiffResolvedBaseline,
  DirectoryDiffStatsResult,
  DirectoryDiffStreamStartResult,
  DirectoryGitState,
  DirectoryUsageSummary,
  InboxChat,
  PiConfiguredSkill,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ReactArtifactCompileResult,
  ShellState,
  WorkspaceNavigationState,
} from './desktop-contracts'
import type { PackageUiService } from './package-ui-contracts'
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from './terminal-contracts'

export type WorkingDirectoriesService = {
  loadDirectoryUsageSummary: (directoryId: string) => Promise<DirectoryUsageSummary>
  loadDirectoryFavicon: (directoryId: string) => Promise<string | null>
}

export type GitService = {
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  startDirectoryDiffStream: (
    directoryId: string,
    baseline?: DirectoryDiffBaseline | null,
    streamId?: string | null,
    includeUntracked?: boolean | null,
  ) => Promise<DirectoryDiffStreamStartResult>
  cancelDirectoryDiffStream: (streamId: string) => Promise<void>
  loadDirectoryDiffStats: (
    directoryId: string,
    baseline?: DirectoryDiffBaseline | null,
    includeUntracked?: boolean | null,
  ) => Promise<DirectoryDiffStatsResult | null>
  loadDirectoryDiffImagePreview: (request: {
    directoryId: string
    baseline?: DirectoryDiffBaseline | null | undefined
    path: string
    side: DirectoryDiffImageSide
  }) => Promise<DirectoryDiffImagePreview>
  loadDirectoryDiffFileContents: (
    request: DirectoryDiffFileContentsRequest,
  ) => Promise<DirectoryDiffFileContentsResult>
  captureDirectoryDiffBaseline: (
    directoryId: string,
  ) => Promise<DirectoryDiffResolvedBaseline | null>
  listDirectoryCommits: (
    directoryId: string,
    limit?: number | null | undefined,
  ) => Promise<DirectoryCommitEntry[]>
}

export type ArtifactsService = {
  listArtifacts: (conversationId?: string | null) => Promise<Artifact[]> | Artifact[]
  getArtifact: (
    artifactSlug: string,
    conversationId?: string | null,
  ) => Promise<Artifact | null> | Artifact | null
  updateArtifact: (request: {
    slug: string
    content: string
    conversationId?: string | null
  }) => Promise<Artifact> | Artifact
  editArtifact: (request: {
    slug: string
    conversationId?: string | null
    edits: Array<{ oldText: string; newText: string }>
  }) => Promise<Artifact> | Artifact
  listArtifactVersions: (artifactSlug: string) => Promise<ArtifactVersion[]> | ArtifactVersion[]
  compileReactArtifact: (source: string) => Promise<ReactArtifactCompileResult>
}

export type DictationService = {
  getDictationState: () => Promise<DictationState>
  listDictationModels: () => Promise<DictationModelSummary[]>
  installDictationModel: (request: {
    modelId: 'tiny.en' | 'base.en' | 'small.en'
  }) => Promise<DictationModelInstallResult>
  removeDictationModel: (request: {
    modelId: 'tiny.en' | 'base.en' | 'small.en'
  }) => Promise<DictationModelRemoveResult>
  transcribeDictation: (
    request: DictationTranscriptionRequest,
  ) => Promise<DictationTranscriptionResult>
}

export type AppService = {
  disposeDesktopRuntime?: () => Promise<void> | void
  handleDesktopAction: (
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ) => Promise<DesktopActionResultData | null | undefined>
  loadArchivedChatList: () => Promise<ArchivedChat[]>
  loadInboxChatList: () => Promise<InboxChat[]>
  loadComposerState: (request: ComposerStateRequest) => Promise<ComposerState>
  loadComposerSlashCommands: (request: ComposerStateRequest) => Promise<ComposerSlashCommand[]>
  loadComposerSkills: (request: ComposerStateRequest) => Promise<ComposerSkillReference[]>
  loadDirectoryChats: (directoryId: string) => Promise<Chat[]>
  loadWorkspaceNavigationState: (
    selectedWorkspaceId?: string | null,
  ) => Promise<WorkspaceNavigationState> | WorkspaceNavigationState
  createWorkspace: (name: string) => Promise<WorkspaceNavigationState> | WorkspaceNavigationState
  loadShellState: (cwd: string) => Promise<ShellState>
  loadAppSettings: () => Promise<AppSettings> | AppSettings
  loadConversationEntries: (conversationId: string) => Promise<ConversationEntryList | null>
  loadChatPreviewAtEntry: (
    conversationId: string,
    targetEntryId: string,
    options?: { historyCompactions?: number },
  ) => Promise<ChatData | null>
  loadChat: (
    conversationId: string,
    options?: { historyCompactions?: number },
  ) => Promise<ChatData | null>
  searchChat: (conversationId: string, query: string) => Promise<ChatSearchResult>
  watchConversation: (conversationId: string | null) => Promise<void>
  subscribeDesktopEvents: (listener: (event: DesktopEvent) => void) => () => void
}
export type TerminalService = {
  closeAllTerminals: () => Promise<void>
  closeTerminal: (request: TerminalCloseRequest) => Promise<void>
  getTerminalStatus: (sessionId: string) => Promise<TerminalStatusSnapshot>
  listTerminals: () => Promise<TerminalSessionSnapshot[]>
  openTerminal: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
  subscribeTerminalEvents: (listener: (event: TerminalEvent) => void) => () => void
  writeTerminal: (sessionId: string, data: string) => Promise<void>
}

export type PiSkillsService = {
  searchPiSkills: (request?: {
    query?: string | null | undefined
    limit?: number | null | undefined
  }) => Promise<PiSkillCatalogPage>
  listConfiguredPiSkills: (request?: {
    directoryPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiConfiguredSkill[]>
  installPiSkill: (request: {
    source: string
    local?: boolean | undefined
    directoryPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiSkillMutationResult>
  removePiSkill: (request: {
    installedPath: string
    directoryPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiSkillMutationResult>
}

export type DesktopServiceRuntime = {
  app: AppService
  packages: PackageUiService
  skills: PiSkillsService
  git: GitService
  workingDirectories: WorkingDirectoriesService
  artifacts: ArtifactsService
  dictation: DictationService
  terminalManager: TerminalService
}
