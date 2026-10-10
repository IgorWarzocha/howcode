import type { GitRequestMap } from '@howaboua/howcode-git/host/contracts'
import type { ConversationEntryList } from './conversation-entries'
import type { DesktopAction } from './desktop-actions'
import type {
  AnyDesktopActionPayload,
  ArchivedChat,
  Artifact,
  ArtifactVersion,
  Chat,
  ChatData,
  ChatSearchResult,
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
  DirectoryUsageSummary,
  InboxChat,
  PiConfiguredSkill,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ReactArtifactCompileResult,
  ShellState,
  WorkspaceNavigationState,
} from './desktop-contracts'
import type {
  InstalledComponentAdmission,
  InstalledComponentDescriptor,
  InstalledComponentSource,
} from './installed-component-contracts'
import type {
  PackageUiDescriptor,
  PackageUiJson,
  PackageUiReference,
  PackageUiService,
} from './package-ui-contracts'
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalStatusRequest,
  TerminalStatusSnapshot,
  TerminalWriteRequest,
} from './terminal-contracts'
import type { WorkspaceLayoutRequest, WorkspaceLayoutResponse } from './workspace-layout-contracts'

export type DesktopRequestMap = GitRequestMap & {
  workspaceLayout: { params: WorkspaceLayoutRequest; response: WorkspaceLayoutResponse }
  pluginRequest: { params: { plugin: string; method: string; payload: unknown }; response: unknown }
  listPackageUis: { params: Record<string, never>; response: PackageUiDescriptor[] }
  listInstalledComponents: {
    params: Record<string, never>
    response: InstalledComponentDescriptor[]
  }
  admitInstalledComponent: { params: InstalledComponentAdmission; response: undefined }
  loadInstalledComponent: { params: PackageUiReference; response: InstalledComponentSource }
  loadPackageUi: { params: PackageUiReference; response: { js: string } }
  openPackageUiBinding: {
    params: Parameters<PackageUiService['openPackageUiBinding']>[0]
    response: undefined
  }
  readPackageUiBindingEvents: {
    params: Parameters<PackageUiService['readPackageUiBindingEvents']>[0]
    response: Awaited<ReturnType<PackageUiService['readPackageUiBindingEvents']>>
  }
  operatePackageUiBinding: {
    params: Parameters<PackageUiService['operatePackageUiBinding']>[0]
    response: PackageUiJson
  }
  closePackageUiBinding: {
    params: Parameters<PackageUiService['closePackageUiBinding']>[0]
    response: undefined
  }
  getShellState: { params: Record<string, never>; response: ShellState }
  getDirectoryUsageSummary: { params: { directoryId: string }; response: DirectoryUsageSummary }
  getDirectoryFavicon: { params: { directoryId: string }; response: string | null }
  searchPiSkills: {
    params: {
      query?: string | undefined | null | undefined
      limit?: number | undefined | null | undefined
    }
    response: PiSkillCatalogPage
  }
  getConfiguredPiSkills: {
    params: { directoryPath?: string | undefined | null | undefined; chat?: boolean | undefined }
    response: PiConfiguredSkill[]
  }
  installPiSkill: {
    params: {
      source: string
      local?: boolean | undefined
      directoryPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiSkillMutationResult
  }
  removePiSkill: {
    params: {
      installedPath: string
      directoryPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiSkillMutationResult
  }
  listDirectoryDirectoryEntries: {
    params: { path?: string | undefined | null | undefined }
    response: {
      homePath: string
      currentPath: string
      parentPath: string | null
      entries: Array<{ path: string; name: string; kind: 'directory' }>
    }
  }
  listComposerAttachmentEntries: {
    params: {
      directoryId?: string | undefined | null | undefined
      path?: string | undefined | null | undefined
      rootPath?: string | undefined | null | undefined
    }
    response: ComposerFilePickerState
  }
  searchComposerAttachmentEntries: {
    params: {
      directoryId?: string | undefined | null | undefined
      query?: string | undefined | null | undefined
      limit?: number | undefined | null | undefined
    }
    response: ComposerFileSearchEntry[]
  }
  getComposerState: { params: ComposerStateRequest; response: ComposerState }
  getComposerSlashCommands: { params: ComposerStateRequest; response: ComposerSlashCommand[] }
  getComposerSkills: { params: ComposerStateRequest; response: ComposerSkillReference[] }
  getDictationState: { params: Record<string, never>; response: DictationState }
  listDictationModels: { params: Record<string, never>; response: DictationModelSummary[] }
  installDictationModel: {
    params: { modelId: 'tiny.en' | 'base.en' | 'small.en' }
    response: DictationModelInstallResult
  }
  removeDictationModel: {
    params: { modelId: 'tiny.en' | 'base.en' | 'small.en' }
    response: DictationModelRemoveResult
  }
  transcribeDictation: {
    params: DictationTranscriptionRequest
    response: DictationTranscriptionResult
  }
  getDirectoryChats: {
    params: { directoryId: string } | undefined
    response: Chat[]
  }
  getWorkspaceNavigationState: {
    params: { selectedWorkspaceId?: string | undefined | null | undefined } | undefined
    response: WorkspaceNavigationState
  }
  createWorkspace: { params: { name: string }; response: WorkspaceNavigationState }
  listArtifacts: {
    params: { conversationId?: string | undefined | null | undefined } | undefined
    response: Artifact[]
  }
  getArtifact: {
    params: { artifactSlug: string; conversationId?: string | undefined | null | undefined }
    response: Artifact | null
  }
  updateArtifact: {
    params: {
      artifactSlug: string
      content: string
      conversationId?: string | undefined | null | undefined
    }
    response: Artifact
  }
  editArtifact: {
    params: {
      artifactSlug: string
      conversationId?: string | undefined | null | undefined
      edits: Array<{ oldText: string; newText: string }>
    }
    response: Artifact
  }
  listArtifactVersions: { params: { artifactSlug: string }; response: ArtifactVersion[] }
  compileReactArtifact: { params: { source: string }; response: ReactArtifactCompileResult }
  getInboxChats: { params: Record<string, never>; response: InboxChat[] }
  getArchivedChats: { params: Record<string, never>; response: ArchivedChat[] }
  getChat: {
    params: { conversationId: string; historyCompactions?: number | undefined }
    response: ChatData | null
  }
  getConversationEntries: {
    params: { conversationId: string }
    response: ConversationEntryList | null
  }
  getChatPreviewAtEntry: {
    params: {
      conversationId: string
      targetEntryId: string
      historyCompactions?: number | undefined
    }
    response: ChatData | null
  }
  searchChat: {
    params: { conversationId: string; query: string }
    response: ChatSearchResult
  }
  watchConversation: { params: { conversationId: string | null }; response: { ok: boolean } }
  invokeAction: {
    params: { action: DesktopAction; payload?: AnyDesktopActionPayload | undefined }
    response: DesktopActionResult
  }
  listTerminals: { params: Record<string, never>; response: TerminalSessionSnapshot[] }
  terminalOpen: { params: TerminalOpenRequest; response: TerminalSessionSnapshot }
  terminalWrite: { params: TerminalWriteRequest; response: { ok: boolean } }
  terminalResize: { params: TerminalResizeRequest; response: { ok: boolean } }
  terminalClose: { params: TerminalCloseRequest; response: { ok: boolean } }
  terminalStatus: { params: TerminalStatusRequest; response: TerminalStatusSnapshot }
}

export type DesktopEventMap = {
  desktopEvent: DesktopEvent
  terminalEvent: TerminalEvent
}

export type DesktopRequestChannel = keyof DesktopRequestMap
export type DesktopEventChannel = keyof DesktopEventMap

export type DesktopRequestHandlerMap = {
  [K in DesktopRequestChannel]: (
    params: DesktopRequestMap[K]['params'],
  ) => Promise<DesktopRequestMap[K]['response']> | DesktopRequestMap[K]['response']
}

export function getDesktopRequestIpcChannel(channel: DesktopRequestChannel) {
  return `howcode:request:${channel}`
}

export function getDesktopEventIpcChannel(channel: DesktopEventChannel) {
  return `howcode:event:${channel}`
}
