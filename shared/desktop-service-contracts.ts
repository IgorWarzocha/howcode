import type { DesktopAction } from './desktop-actions'
import type {
  AnyDesktopActionPayload,
  AppSettings,
  ArchivedThread,
  Artifact,
  ArtifactVersion,
  ChatSidebarState,
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
  InboxThread,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffImagePreview,
  ProjectDiffImageSide,
  ProjectDiffResolvedBaseline,
  ProjectDiffStatsResult,
  ProjectDiffStreamStartResult,
  ProjectGitState,
  ProjectUsageSummary,
  ReactArtifactCompileResult,
  ShellState,
  SkillCreatorSessionState,
  Thread,
  ThreadData,
  ThreadSearchResult,
} from './desktop-contracts'
import type { SessionTreeList } from './session-tree.ts'
import type {
  TerminalEvent,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from './terminal-contracts'

export type PiThreadsService = {
  disposeDesktopRuntime?: () => Promise<void> | void
  handleDesktopAction: (
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ) => Promise<DesktopActionResultData | null | undefined>
  loadArchivedThreadList: () => Promise<ArchivedThread[]>
  loadInboxThreadList: () => Promise<InboxThread[]>
  loadComposerState: (request: ComposerStateRequest) => Promise<ComposerState>
  loadComposerSlashCommands: (request: ComposerStateRequest) => Promise<ComposerSlashCommand[]>
  loadComposerSkills: (request: ComposerStateRequest) => Promise<ComposerSkillReference[]>
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
  searchPiPackages: (request?: {
    query?: string | null | undefined
    cursor?: number | null | undefined
    pageSize?: number | null | undefined
  }) => Promise<PiPackageCatalogPage>
  listConfiguredPiPackages: (request?: {
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiConfiguredPackage[]>
  installPiPackage: (request: {
    source: string
    kind?: 'npm' | 'git' | undefined
    local?: boolean | undefined
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiPackageMutationResult>
  removePiPackage: (request: {
    source: string
    local?: boolean | undefined
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiPackageMutationResult>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadProjectUsageSummary: (projectId: string) => Promise<ProjectUsageSummary>
  loadProjectFavicon: (projectId: string) => Promise<string | null>
  startProjectDiffStream: (
    projectId: string,
    baseline?: ProjectDiffBaseline | null,
    streamId?: string | null,
    includeUntracked?: boolean | null,
  ) => Promise<ProjectDiffStreamStartResult>
  cancelProjectDiffStream: (streamId: string) => Promise<void>
  loadProjectDiffStats: (
    projectId: string,
    baseline?: ProjectDiffBaseline | null,
    includeUntracked?: boolean | null,
  ) => Promise<ProjectDiffStatsResult | null>
  loadProjectDiffImagePreview: (request: {
    projectId: string
    baseline?: ProjectDiffBaseline | null | undefined
    path: string
    side: ProjectDiffImageSide
  }) => Promise<ProjectDiffImagePreview>
  captureProjectDiffBaseline: (projectId: string) => Promise<ProjectDiffResolvedBaseline | null>
  listProjectCommits: (
    projectId: string,
    limit?: number | null | undefined,
  ) => Promise<ProjectCommitEntry[]>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean | undefined },
  ) => Promise<Thread[]>
  loadChatSidebarState: (
    selectedGroupId?: string | null,
  ) => Promise<ChatSidebarState> | ChatSidebarState
  createChatGroup: (name: string) => Promise<ChatSidebarState> | ChatSidebarState
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
  loadShellState: (cwd: string) => Promise<ShellState>
  loadAppSettings: () => Promise<AppSettings> | AppSettings
  loadSessionTreeList: (sessionPath: string) => Promise<SessionTreeList | null>
  loadThreadPreviewAtEntry: (
    sessionPath: string,
    targetEntryId: string,
    options?: { historyCompactions?: number },
  ) => Promise<ThreadData | null>
  loadThread: (
    sessionPath: string,
    options?: { historyCompactions?: number },
  ) => Promise<ThreadData | null>
  searchThread: (sessionPath: string, query: string) => Promise<ThreadSearchResult>
  setWatchedSessionPath: (sessionPath: string | null) => Promise<void>
  subscribeDesktopEvents: (listener: (event: DesktopEvent) => void) => () => void
}

export type TerminalService = {
  closeAllTerminals?: () => Promise<void>
  closeTerminal: (request: {
    sessionId: string
    deleteHistory?: boolean | undefined
  }) => Promise<void>
  getTerminalStatus: (sessionId: string) => Promise<TerminalStatusSnapshot>
  listTerminals: () => Promise<TerminalSessionSnapshot[]>
  openTerminal: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
  statSessionFile: (sessionId: string) => Promise<{ mtimeMs: number; size: number } | null>
  subscribeTerminalEvents: (listener: (event: TerminalEvent) => void) => () => void
  writeTerminal: (sessionId: string, data: string) => Promise<void>
}

export type PiSkillsService = {
  searchPiSkills: (request?: {
    query?: string | null | undefined
    limit?: number | null | undefined
  }) => Promise<PiSkillCatalogPage>
  listConfiguredPiSkills: (request?: {
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiConfiguredSkill[]>
  installPiSkill: (request: {
    source: string
    local?: boolean | undefined
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiSkillMutationResult>
  removePiSkill: (request: {
    installedPath: string
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<PiSkillMutationResult>
}

export type SkillCreatorService = {
  startSkillCreatorSession: (request: {
    prompt: string
    local?: boolean | undefined
    projectPath?: string | null | undefined
    chat?: boolean | undefined
  }) => Promise<SkillCreatorSessionState>
  continueSkillCreatorSession: (request: {
    sessionId: string
    prompt: string
  }) => Promise<SkillCreatorSessionState>
  closeSkillCreatorSession: (request: { sessionId: string }) => Promise<{ ok: boolean }>
}

export type DesktopServiceRuntime = {
  piThreads: PiThreadsService
  piSkills: PiSkillsService
  skillCreator: SkillCreatorService
  terminalManager: TerminalService
}
