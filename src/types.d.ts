import type { DesktopAction } from './app/desktop/actions'
import type {
  AnyDesktopActionPayload,
  AppUpdateState,
  ArchivedThread,
  Artifact,
  ArtifactVersion,
  ChatSidebarState,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerFileSearchEntry,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopClipboardFilePaths,
  DesktopClipboardImage,
  DesktopClipboardSnapshot,
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
  ProjectDiffResolvedBaseline,
  ProjectDiffResult,
  ProjectDiffStatsResult,
  ProjectGitState,
  ReactArtifactCompileResult,
  ShellState,
  SkillCreatorSessionState,
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
  Thread,
  ThreadData,
} from './app/desktop/types'

declare global {
  // Prism is installed by src/main.tsx for @mdxeditor/@lexical code highlighting.
  var Prism: unknown

  interface Window {
    howcodeDevWebBridge?: boolean
    piDesktop?: {
      getAppUpdateState?: () => Promise<AppUpdateState>
      checkAppUpdate?: () => Promise<AppUpdateState>
      installAppUpdate?: () => Promise<AppUpdateState>
      restartAppUpdate?: () => Promise<AppUpdateState>
      clearClipboardImages?: () => Promise<{ clearedCount: number; clearFailedCount: number }>
      getShellState: () => Promise<ShellState>
      getProjectGitState?: (projectId: string) => Promise<ProjectGitState | null>
      getProjectDiff?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
      ) => Promise<ProjectDiffResult | null>
      getProjectDiffStats?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
      ) => Promise<ProjectDiffStatsResult | null>
      captureProjectDiffBaseline?: (
        projectId: string,
      ) => Promise<ProjectDiffResolvedBaseline | null>
      listProjectCommits?: (
        projectId: string,
        limit?: number | null | undefined,
      ) => Promise<ProjectCommitEntry[]>
      searchPiPackages?: (request?: {
        query?: string | null | undefined
        cursor?: number | null | undefined
        pageSize?: number | null | undefined
      }) => Promise<PiPackageCatalogPage>
      getConfiguredPiPackages?: (request?: {
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiConfiguredPackage[]>
      installPiPackage?: (request: {
        source: string
        kind?: 'npm' | 'git' | undefined
        local?: boolean | undefined
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiPackageMutationResult>
      removePiPackage?: (request: {
        source: string
        local?: boolean | undefined
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiPackageMutationResult>
      searchPiSkills?: (request?: {
        query?: string | null | undefined
        limit?: number | null | undefined
      }) => Promise<PiSkillCatalogPage>
      getConfiguredPiSkills?: (request?: {
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiConfiguredSkill[]>
      installPiSkill?: (request: {
        source: string
        local?: boolean | undefined
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiSkillMutationResult>
      removePiSkill?: (request: {
        installedPath: string
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiSkillMutationResult>
      startSkillCreatorSession?: (request: {
        prompt: string
        local?: boolean | undefined
        projectPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<SkillCreatorSessionState>
      continueSkillCreatorSession?: (request: {
        sessionId: string
        prompt: string
      }) => Promise<SkillCreatorSessionState>
      closeSkillCreatorSession?: (sessionId: string) => Promise<{ ok: boolean }>
      pickComposerAttachments?: (
        projectId?: string | null | undefined,
      ) => Promise<ComposerAttachment[]>
      readClipboardSnapshot?: (formats?: string[] | null) => Promise<DesktopClipboardSnapshot>
      readClipboardFilePaths?: () => Promise<DesktopClipboardFilePaths>
      readClipboardImage?: () => Promise<DesktopClipboardImage>
      getAttachmentKindsForPaths?: (
        paths: string[],
      ) => Promise<Record<string, ComposerAttachment['kind'] | null>>
      getPathForFile?: (file: File) => string | null
      listComposerAttachmentEntries?: (request?: {
        projectId?: string | null | undefined
        path?: string | null | undefined
        rootPath?: string | null | undefined
      }) => Promise<ComposerFilePickerState>
      searchComposerAttachmentEntries?: (request?: {
        projectId?: string | null | undefined
        query?: string | null | undefined
        limit?: number | null | undefined
      }) => Promise<ComposerFileSearchEntry[]>
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>
      getComposerSlashCommands?: (request?: ComposerStateRequest) => Promise<ComposerSlashCommand[]>
      getComposerSkills?: (request?: ComposerStateRequest) => Promise<ComposerSkillReference[]>
      getDictationState?: () => Promise<DictationState>
      listDictationModels?: () => Promise<DictationModelSummary[]>
      installDictationModel?: (
        modelId: 'tiny.en' | 'base.en' | 'small.en',
      ) => Promise<DictationModelInstallResult>
      removeDictationModel?: (
        modelId: 'tiny.en' | 'base.en' | 'small.en',
      ) => Promise<DictationModelRemoveResult>
      transcribeDictation?: (
        request: DictationTranscriptionRequest,
      ) => Promise<DictationTranscriptionResult>
      getProjectThreads?: (
        projectId: string,
        request?: { chat?: boolean | undefined },
      ) => Promise<Thread[]>
      getChatSidebarState?: (selectedGroupId?: string | null) => Promise<ChatSidebarState>
      createChatGroup?: (name: string) => Promise<ChatSidebarState>
      listArtifacts?: (conversationId?: string | null) => Promise<Artifact[]>
      getArtifact?: (
        artifactSlug: string,
        conversationId?: string | null,
      ) => Promise<Artifact | null>
      updateArtifact?: (
        artifactSlug: string,
        content: string,
        conversationId?: string | null,
      ) => Promise<Artifact>
      editArtifact?: (
        artifactSlug: string,
        edits: Array<{ oldText: string; newText: string }>,
        conversationId?: string | null,
      ) => Promise<Artifact>
      listArtifactVersions?: (artifactSlug: string) => Promise<ArtifactVersion[]>
      compileReactArtifact?: (source: string) => Promise<ReactArtifactCompileResult>
      getInboxThreads?: () => Promise<InboxThread[]>
      getArchivedThreads?: () => Promise<ArchivedThread[]>
      getThread?: (sessionPath: string, historyCompactions?: number) => Promise<ThreadData | null>
      watchSession?: (sessionPath: string | null) => Promise<void>
      listTerminals?: () => Promise<TerminalSessionSnapshot[]>
      openTerminal?: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>
      writeTerminal?: (sessionId: string, data: string) => Promise<void>
      resizeTerminal?: (request: TerminalResizeRequest) => Promise<void>
      closeTerminal?: (request: TerminalCloseRequest) => Promise<void>
      statTerminalSessionFile?: (sessionId: string) => Promise<TerminalSessionFileStat | null>
      getTerminalStatus?: (sessionId: string) => Promise<TerminalStatusSnapshot>
      subscribeTerminal?: (listener: (event: TerminalEvent) => void) => () => void
      openExternal?: (url: string) => Promise<boolean>
      openPath?: (path: string) => Promise<boolean>
      saveTextToDownloads?: (
        fileName: string,
        content: string,
      ) => Promise<{ ok: boolean; path?: string | undefined; error?: string | undefined }>
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void
      invokeAction: (
        action: DesktopAction,
        payload?: AnyDesktopActionPayload,
      ) => Promise<DesktopActionResult>
    }
  }
}
