import type { DesktopAction } from './desktop-actions'
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
  Thread,
  ThreadData,
} from './desktop-contracts'
import type {
  HowcodeRemoteEnvironment,
  HowcodeRemoteEnvironmentInput,
  HowcodeServerConnectionState,
} from './howcode-server-contracts'
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionFileStatRequest,
  TerminalSessionSnapshot,
  TerminalStatusRequest,
  TerminalStatusSnapshot,
  TerminalWriteRequest,
} from './terminal-contracts'

export type DesktopRequestMap = {
  getAppUpdateState: { params: Record<string, never>; response: AppUpdateState }
  checkAppUpdate: { params: Record<string, never>; response: AppUpdateState }
  installAppUpdate: { params: Record<string, never>; response: AppUpdateState }
  restartAppUpdate: { params: Record<string, never>; response: AppUpdateState }
  clearClipboardImages: {
    params: Record<string, never>
    response: { clearedCount: number; clearFailedCount: number }
  }
  getHowcodeServerState: { params: Record<string, never>; response: HowcodeServerConnectionState }
  refreshHowcodeServerState: {
    params: Record<string, never>
    response: HowcodeServerConnectionState
  }
  listHowcodeRemoteEnvironments: {
    params: Record<string, never>
    response: HowcodeRemoteEnvironment[]
  }
  saveHowcodeRemoteEnvironment: {
    params: HowcodeRemoteEnvironmentInput
    response: HowcodeRemoteEnvironment
  }
  deleteHowcodeRemoteEnvironment: {
    params: { id: string }
    response: { ok: boolean }
  }
  getShellState: { params: Record<string, never>; response: ShellState }
  getProjectGitState: { params: { projectId: string }; response: ProjectGitState | null }
  getProjectDiff: {
    params: { projectId: string; baseline?: ProjectDiffBaseline | null }
    response: ProjectDiffResult | null
  }
  getProjectDiffStats: {
    params: { projectId: string; baseline?: ProjectDiffBaseline | null }
    response: ProjectDiffStatsResult | null
  }
  captureProjectDiffBaseline: {
    params: { projectId: string }
    response: ProjectDiffResolvedBaseline | null
  }
  listProjectCommits: {
    params: { projectId: string; limit?: number | undefined | null | undefined }
    response: ProjectCommitEntry[]
  }
  searchPiPackages: {
    params: {
      query?: string | undefined | null | undefined
      cursor?: number | undefined | null | undefined
      pageSize?: number | undefined | null | undefined
    }
    response: PiPackageCatalogPage
  }
  getConfiguredPiPackages: {
    params: { projectPath?: string | undefined | null | undefined; chat?: boolean | undefined }
    response: PiConfiguredPackage[]
  }
  installPiPackage: {
    params: {
      source: string
      kind?: 'npm' | 'git' | undefined
      local?: boolean | undefined
      projectPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiPackageMutationResult
  }
  removePiPackage: {
    params: {
      source: string
      local?: boolean | undefined
      projectPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: PiPackageMutationResult
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
  startSkillCreatorSession: {
    params: {
      prompt: string
      local?: boolean | undefined
      projectPath?: string | undefined | null | undefined
      chat?: boolean | undefined
    }
    response: SkillCreatorSessionState
  }
  continueSkillCreatorSession: {
    params: { sessionId: string; prompt: string }
    response: SkillCreatorSessionState
  }
  closeSkillCreatorSession: {
    params: { sessionId: string }
    response: { ok: boolean }
  }
  pickComposerAttachments: {
    params: { projectId?: string | undefined | null | undefined }
    response: ComposerAttachment[]
  }
  readClipboardSnapshot: {
    params: { formats?: string[] | undefined | null | undefined }
    response: DesktopClipboardSnapshot
  }
  readClipboardFilePaths: {
    params: Record<string, never>
    response: DesktopClipboardFilePaths
  }
  readClipboardImage: {
    params: Record<string, never>
    response: DesktopClipboardImage
  }
  getAttachmentKindsForPaths: {
    params: { paths: string[] }
    response: Record<string, ComposerAttachment['kind'] | null>
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
    params: { sessionPath: string; historyCompactions?: number | undefined }
    response: ThreadData | null
  }
  watchSession: { params: { sessionPath: string | null }; response: { ok: boolean } }
  invokeAction: {
    params: { action: DesktopAction; payload?: AnyDesktopActionPayload | undefined }
    response: DesktopActionResult
  }
  listTerminals: { params: Record<string, never>; response: TerminalSessionSnapshot[] }
  terminalOpen: { params: TerminalOpenRequest; response: TerminalSessionSnapshot }
  terminalWrite: { params: TerminalWriteRequest; response: { ok: boolean } }
  terminalResize: { params: TerminalResizeRequest; response: { ok: boolean } }
  terminalClose: { params: TerminalCloseRequest; response: { ok: boolean } }
  terminalSessionFileStat: {
    params: TerminalSessionFileStatRequest
    response: TerminalSessionFileStat | null
  }
  terminalStatus: { params: TerminalStatusRequest; response: TerminalStatusSnapshot }
  openExternal: { params: { url: string }; response: { ok: boolean } }
  openPath: { params: { path: string }; response: { ok: boolean } }
  saveTextToDownloads: {
    params: { fileName: string; content: string }
    response: { ok: boolean; path?: string | undefined; error?: string | undefined }
  }
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
