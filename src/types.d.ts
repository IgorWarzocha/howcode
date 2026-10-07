import type { DesktopBridgeCapabilities } from '@howcode/shared/desktop-bridge-capabilities'
import type { DesktopRequestMap } from '../shared/desktop-ipc'
import type { DesktopAction } from './app/desktop/actions'
import type {
  AnyDesktopActionPayload,
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
  DesktopEvent,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
  InboxThread,
  PiConfiguredSkill,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffFileContentsRequest,
  ProjectDiffFileContentsResult,
  ProjectDiffImagePreview,
  ProjectDiffImageSide,
  ProjectDiffResolvedBaseline,
  ProjectDiffStatsResult,
  ProjectDiffStreamStartResult,
  ProjectGitState,
  ProjectUsageSummary,
  ReactArtifactCompileResult,
  ShellState,
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
  Thread,
  ThreadData,
  ThreadSearchResult,
} from './app/desktop/types'

declare global {
  // Prism is installed lazily for @mdxeditor/@lexical code highlighting.
  var Prism: unknown
  var prism: unknown

  interface Window {
    piDesktop?: {
      platform?: string
      capabilities?: DesktopBridgeCapabilities
      getShellState: () => Promise<ShellState>
      getProjectGitState?: (projectId: string) => Promise<ProjectGitState | null>
      getProjectUsageSummary?: (projectId: string) => Promise<ProjectUsageSummary>
      getProjectFavicon?: (projectId: string) => Promise<string | null>
      startProjectDiffStream?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
        streamId?: string | null,
        includeUntracked?: boolean | null,
      ) => Promise<ProjectDiffStreamStartResult>
      cancelProjectDiffStream?: (streamId: string) => Promise<void>
      getProjectDiffStats?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
        includeUntracked?: boolean | null,
      ) => Promise<ProjectDiffStatsResult | null>
      getProjectDiffImagePreview?: (request: {
        projectId: string
        baseline?: ProjectDiffBaseline | null | undefined
        path: string
        side: ProjectDiffImageSide
      }) => Promise<ProjectDiffImagePreview>
      getProjectDiffFileContents?: (
        request: ProjectDiffFileContentsRequest,
      ) => Promise<ProjectDiffFileContentsResult>
      captureProjectDiffBaseline?: (
        projectId: string,
      ) => Promise<ProjectDiffResolvedBaseline | null>
      listProjectCommits?: (
        projectId: string,
        limit?: number | null | undefined,
      ) => Promise<ProjectCommitEntry[]>
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
      listProjectDirectoryEntries?: (
        request?: DesktopRequestMap['listProjectDirectoryEntries']['params'],
      ) => Promise<DesktopRequestMap['listProjectDirectoryEntries']['response']>
      uploadComposerFiles?: (files: File[]) => Promise<ComposerAttachment[]>
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
      getThread?: (
        conversationId: string,
        historyCompactions?: number,
      ) => Promise<ThreadData | null>
      getConversationEntries?: (
        conversationId: string,
      ) => Promise<import('@howcode/shared/conversation-entries').ConversationEntryList | null>
      getThreadPreviewAtEntry?: (
        conversationId: string,
        targetEntryId: string,
        historyCompactions?: number,
      ) => Promise<ThreadData | null>
      searchThread?: (conversationId: string, query: string) => Promise<ThreadSearchResult>
      watchConversation?: (conversationId: string | null) => Promise<void>
      listTerminals?: () => Promise<TerminalSessionSnapshot[]>
      openTerminal?: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>
      writeTerminal?: (sessionId: string, data: string) => Promise<void>
      resizeTerminal?: (request: TerminalResizeRequest) => Promise<void>
      closeTerminal?: (request: TerminalCloseRequest) => Promise<void>
      getTerminalStatus?: (sessionId: string) => Promise<TerminalStatusSnapshot>
      subscribeTerminal?: (listener: (event: TerminalEvent) => void) => () => void
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void
      invokeAction: (
        action: DesktopAction,
        payload?: AnyDesktopActionPayload,
      ) => Promise<DesktopActionResult>
    }
  }
}
