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
import type {
  PackageUiDescriptor,
  PackageUiJson,
  PackageUiReference,
  PackageUiRpcRequest,
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

export type DesktopRequestMap = {
  listPackageUis: { params: Record<string, never>; response: PackageUiDescriptor[] }
  loadPackageUi: { params: PackageUiReference; response: { js: string } }
  invokePackageUiRpc: { params: PackageUiRpcRequest; response: PackageUiJson }
  getShellState: { params: Record<string, never>; response: ShellState }
  getDirectoryGitState: { params: { directoryId: string }; response: DirectoryGitState | null }
  getDirectoryUsageSummary: { params: { directoryId: string }; response: DirectoryUsageSummary }
  getDirectoryFavicon: { params: { directoryId: string }; response: string | null }
  startDirectoryDiffStream: {
    params: {
      directoryId: string
      baseline?: DirectoryDiffBaseline | null
      streamId?: string | null
      includeUntracked?: boolean | null
    }
    response: DirectoryDiffStreamStartResult
  }
  cancelDirectoryDiffStream: {
    params: { streamId: string }
    response: undefined
  }
  getDirectoryDiffStats: {
    params: {
      directoryId: string
      baseline?: DirectoryDiffBaseline | null
      includeUntracked?: boolean | null
    }
    response: DirectoryDiffStatsResult | null
  }
  getDirectoryDiffImagePreview: {
    params: {
      directoryId: string
      baseline?: DirectoryDiffBaseline | null | undefined
      path: string
      side: DirectoryDiffImageSide
    }
    response: DirectoryDiffImagePreview
  }
  getDirectoryDiffFileContents: {
    params: DirectoryDiffFileContentsRequest
    response: DirectoryDiffFileContentsResult
  }
  captureDirectoryDiffBaseline: {
    params: { directoryId: string }
    response: DirectoryDiffResolvedBaseline | null
  }
  listDirectoryCommits: {
    params: { directoryId: string; limit?: number | undefined | null | undefined }
    response: DirectoryCommitEntry[]
  }
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
