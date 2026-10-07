import type { ConversationEntryList } from './conversation-entries'
import type { DesktopAction } from './desktop-actions'
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  Artifact,
  ArtifactVersion,
  ChatSidebarState,
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
  Thread,
  ThreadData,
  ThreadSearchResult,
} from './desktop-contracts'
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
  getShellState: { params: Record<string, never>; response: ShellState }
  getProjectGitState: { params: { projectId: string }; response: ProjectGitState | null }
  getProjectUsageSummary: { params: { projectId: string }; response: ProjectUsageSummary }
  getProjectFavicon: { params: { projectId: string }; response: string | null }
  startProjectDiffStream: {
    params: {
      projectId: string
      baseline?: ProjectDiffBaseline | null
      streamId?: string | null
      includeUntracked?: boolean | null
    }
    response: ProjectDiffStreamStartResult
  }
  cancelProjectDiffStream: {
    params: { streamId: string }
    response: undefined
  }
  getProjectDiffStats: {
    params: {
      projectId: string
      baseline?: ProjectDiffBaseline | null
      includeUntracked?: boolean | null
    }
    response: ProjectDiffStatsResult | null
  }
  getProjectDiffImagePreview: {
    params: {
      projectId: string
      baseline?: ProjectDiffBaseline | null | undefined
      path: string
      side: ProjectDiffImageSide
    }
    response: ProjectDiffImagePreview
  }
  getProjectDiffFileContents: {
    params: ProjectDiffFileContentsRequest
    response: ProjectDiffFileContentsResult
  }
  captureProjectDiffBaseline: {
    params: { projectId: string }
    response: ProjectDiffResolvedBaseline | null
  }
  listProjectCommits: {
    params: { projectId: string; limit?: number | undefined | null | undefined }
    response: ProjectCommitEntry[]
  }
  searchPiSkills: {
    params: {
      query?: string | undefined | null | undefined
      limit?: number | undefined | null | undefined
    }
    response: PiSkillCatalogPage
  }
  getConfiguredPiSkills: {
    params: { projectPath?: string | undefined | null | undefined; chat?: boolean | undefined }
    response: PiConfiguredSkill[]
  }
  installPiSkill: {
    params: {
      source: string
      local?: boolean | undefined
      projectPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiSkillMutationResult
  }
  removePiSkill: {
    params: {
      installedPath: string
      projectPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiSkillMutationResult
  }
  listProjectDirectoryEntries: {
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
      projectId?: string | undefined | null | undefined
      path?: string | undefined | null | undefined
      rootPath?: string | undefined | null | undefined
    }
    response: ComposerFilePickerState
  }
  searchComposerAttachmentEntries: {
    params: {
      projectId?: string | undefined | null | undefined
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
  getProjectThreads: {
    params: { projectId: string; chat?: boolean | undefined } | undefined
    response: Thread[]
  }
  getChatSidebarState: {
    params: { selectedGroupId?: string | undefined | null | undefined } | undefined
    response: ChatSidebarState
  }
  createChatGroup: { params: { name: string }; response: ChatSidebarState }
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
  getInboxThreads: { params: Record<string, never>; response: InboxThread[] }
  getArchivedThreads: { params: Record<string, never>; response: ArchivedThread[] }
  getThread: {
    params: { conversationId: string; historyCompactions?: number | undefined }
    response: ThreadData | null
  }
  getConversationEntries: {
    params: { conversationId: string }
    response: ConversationEntryList | null
  }
  getThreadPreviewAtEntry: {
    params: {
      conversationId: string
      targetEntryId: string
      historyCompactions?: number | undefined
    }
    response: ThreadData | null
  }
  searchThread: {
    params: { conversationId: string; query: string }
    response: ThreadSearchResult
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
