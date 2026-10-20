import type { AppControlResult } from './app-control'
import type { ConversationEntryList } from './conversation-entries'
import type { DesktopAction } from './desktop-actions'
import type {
  AnyDesktopActionPayload,
  AppSettings,
  ArchivedChat,
  Chat,
  ChatData,
  ChatSearchResult,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResultData,
  DesktopEvent,
  DirectoryUsageSummary,
  InboxChat,
  ShellState,
  WorkspaceNavigationState,
} from './desktop-contracts'
import type { PackageUiService } from './package-ui-contracts'
import type { ProviderAuthRequest, ProviderAuthResponse } from './provider-auth'

import type { WorkspaceLayoutRequest, WorkspaceLayoutResponse } from './workspace-layout-contracts'

export type WorkingDirectoriesService = {
  loadDirectoryUsageSummary: (directoryId: string) => Promise<DirectoryUsageSummary>
  loadDirectoryFavicon: (directoryId: string) => Promise<string | null>
}

export type PluginService = {
  rendererRequest: (plugin: string, method: string, payload: unknown) => Promise<unknown>
  hostRequest: (plugin: string, method: string, payload: unknown) => Promise<unknown>
  request: (plugin: string, method: string, payload: unknown) => Promise<unknown>
}

export type AppService = {
  appControl: (input: unknown) => Promise<AppControlResult>
  appControlMcp: (input: unknown) => Promise<AppControlResult>
  providerAuth: (request: ProviderAuthRequest) => Promise<ProviderAuthResponse>
  workspaceLayout: (
    request: WorkspaceLayoutRequest,
  ) => Promise<WorkspaceLayoutResponse> | WorkspaceLayoutResponse
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
export type { TerminalService } from '@howaboua/howcode-terminal/contracts'

import type { TerminalService } from '@howaboua/howcode-terminal/contracts'

export type { PiSkillsService } from '@howaboua/howcode-skills/contracts'

import type { PiSkillsService } from '@howaboua/howcode-skills/contracts'

export type DesktopServiceRuntime = {
  app: AppService
  packages: PackageUiService
  skills: PiSkillsService
  plugins: PluginService
  workingDirectories: WorkingDirectoriesService
  terminalManager: TerminalService
}
