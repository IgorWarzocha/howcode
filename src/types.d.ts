import type { DesktopBridgeCapabilities } from '@howcode/shared/desktop-bridge-capabilities'
import type { DesktopRequestMap } from '../shared/desktop-ipc'
import type { DesktopAction } from './app/desktop/actions'
import type {
  AnyDesktopActionPayload,
  ArchivedChat,
  Chat,
  ChatData,
  ChatSearchResult,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerFileSearchEntry,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopEvent,
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
  ShellState,
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
  WorkspaceNavigationState,
} from './app/desktop/types'

declare global {
  interface Window {
    piDesktop?: {
      pluginRequest: (plugin: string, method: string, payload: unknown) => Promise<unknown>
      platform?: string
      capabilities?: DesktopBridgeCapabilities
      getShellState: () => Promise<ShellState>
      getDirectoryGitState?: (directoryId: string) => Promise<DirectoryGitState | null>
      getDirectoryUsageSummary?: (directoryId: string) => Promise<DirectoryUsageSummary>
      getDirectoryFavicon?: (directoryId: string) => Promise<string | null>
      startDirectoryDiffStream?: (
        directoryId: string,
        baseline?: DirectoryDiffBaseline | null,
        streamId?: string | null,
        includeUntracked?: boolean | null,
      ) => Promise<DirectoryDiffStreamStartResult>
      cancelDirectoryDiffStream?: (streamId: string) => Promise<void>
      getDirectoryDiffStats?: (
        directoryId: string,
        baseline?: DirectoryDiffBaseline | null,
        includeUntracked?: boolean | null,
      ) => Promise<DirectoryDiffStatsResult | null>
      getDirectoryDiffImagePreview?: (request: {
        directoryId: string
        baseline?: DirectoryDiffBaseline | null | undefined
        path: string
        side: DirectoryDiffImageSide
      }) => Promise<DirectoryDiffImagePreview>
      getDirectoryDiffFileContents?: (
        request: DirectoryDiffFileContentsRequest,
      ) => Promise<DirectoryDiffFileContentsResult>
      captureDirectoryDiffBaseline?: (
        directoryId: string,
      ) => Promise<DirectoryDiffResolvedBaseline | null>
      listDirectoryCommits?: (
        directoryId: string,
        limit?: number | null | undefined,
      ) => Promise<DirectoryCommitEntry[]>
      searchPiSkills?: (request?: {
        query?: string | null | undefined
        limit?: number | null | undefined
      }) => Promise<PiSkillCatalogPage>
      getConfiguredPiSkills?: (request?: {
        directoryPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiConfiguredSkill[]>
      installPiSkill?: (request: {
        source: string
        local?: boolean | undefined
        directoryPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiSkillMutationResult>
      removePiSkill?: (request: {
        installedPath: string
        directoryPath?: string | null | undefined
        chat?: boolean | undefined
      }) => Promise<PiSkillMutationResult>
      listDirectoryDirectoryEntries?: (
        request?: DesktopRequestMap['listDirectoryDirectoryEntries']['params'],
      ) => Promise<DesktopRequestMap['listDirectoryDirectoryEntries']['response']>
      uploadComposerFiles?: (files: File[]) => Promise<ComposerAttachment[]>
      listComposerAttachmentEntries?: (request?: {
        directoryId?: string | null | undefined
        path?: string | null | undefined
        rootPath?: string | null | undefined
      }) => Promise<ComposerFilePickerState>
      searchComposerAttachmentEntries?: (request?: {
        directoryId?: string | null | undefined
        query?: string | null | undefined
        limit?: number | null | undefined
      }) => Promise<ComposerFileSearchEntry[]>
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>
      getComposerSlashCommands?: (request?: ComposerStateRequest) => Promise<ComposerSlashCommand[]>
      getComposerSkills?: (request?: ComposerStateRequest) => Promise<ComposerSkillReference[]>
      getDirectoryChats?: (directoryId: string) => Promise<Chat[]>
      getWorkspaceNavigationState?: (
        selectedWorkspaceId?: string | null,
      ) => Promise<WorkspaceNavigationState>
      workspaceLayout: (
        request: DesktopRequestMap['workspaceLayout']['params'],
      ) => Promise<DesktopRequestMap['workspaceLayout']['response']>
      createWorkspace?: (name: string) => Promise<WorkspaceNavigationState>
      listPackageUis?: () => Promise<DesktopRequestMap['listPackageUis']['response']>
      listInstalledComponents?: () => Promise<
        DesktopRequestMap['listInstalledComponents']['response']
      >
      installInstalledComponent?: (
        request: DesktopRequestMap['installInstalledComponent']['params'],
      ) => Promise<DesktopRequestMap['installInstalledComponent']['response']>
      updateInstalledComponent?: (
        request: DesktopRequestMap['updateInstalledComponent']['params'],
      ) => Promise<DesktopRequestMap['updateInstalledComponent']['response']>
      removeInstalledComponent?: (
        request: DesktopRequestMap['removeInstalledComponent']['params'],
      ) => Promise<DesktopRequestMap['removeInstalledComponent']['response']>
      admitInstalledComponent?: (
        request: DesktopRequestMap['admitInstalledComponent']['params'],
      ) => Promise<undefined>
      loadInstalledComponent?: (
        reference: DesktopRequestMap['loadInstalledComponent']['params'],
      ) => Promise<DesktopRequestMap['loadInstalledComponent']['response']>
      openPackageUiBinding?: (
        request: DesktopRequestMap['openPackageUiBinding']['params'],
      ) => Promise<void>
      readPackageUiBindingEvents?: (
        request: DesktopRequestMap['readPackageUiBindingEvents']['params'],
      ) => Promise<DesktopRequestMap['readPackageUiBindingEvents']['response']>
      operatePackageUiBinding?: (
        request: DesktopRequestMap['operatePackageUiBinding']['params'],
      ) => Promise<DesktopRequestMap['operatePackageUiBinding']['response']>
      closePackageUiBinding?: (
        request: DesktopRequestMap['closePackageUiBinding']['params'],
      ) => Promise<void>
      loadPackageUi?: (
        reference: DesktopRequestMap['loadPackageUi']['params'],
      ) => Promise<DesktopRequestMap['loadPackageUi']['response']>
      getInboxChats?: () => Promise<InboxChat[]>
      getArchivedChats?: () => Promise<ArchivedChat[]>
      getChat?: (conversationId: string, historyCompactions?: number) => Promise<ChatData | null>
      getConversationEntries?: (
        conversationId: string,
      ) => Promise<import('@howcode/shared/conversation-entries').ConversationEntryList | null>
      getChatPreviewAtEntry?: (
        conversationId: string,
        targetEntryId: string,
        historyCompactions?: number,
      ) => Promise<ChatData | null>
      searchChat?: (conversationId: string, query: string) => Promise<ChatSearchResult>
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
