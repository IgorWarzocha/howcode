import type {
  Artifact,
  ArtifactKind,
  ComposerAttachment,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageMutationResult,
  PiSettings,
  PiSkillMutationResult,
  PiThemeState,
  ThreadData,
  ThreadSearchResult,
} from '../../shared/desktop-contracts.ts'
import type { SessionTreeList } from '../../shared/session-tree.ts'
import type { CommitMessageContext } from '../project-git.ts'

export type RuntimeHostRequestMap = {
  getComposerState: { request: ComposerStateRequest }
  getComposerSlashCommands: { request: ComposerStateRequest }
  getComposerSkills: { request: ComposerStateRequest }
  startNewThread: { request: ComposerStateRequest }
  selectProjectRuntime: { request: ComposerStateRequest }
  openThreadRuntime: { request: ComposerStateRequest }
  invalidateRuntimeSettings: {
    sessionPath?: string | undefined | null | undefined
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  disposeRuntimeHosts: {
    sessionPaths?: string[] | undefined
    projectPath?: string | undefined | null | undefined
  }
  getPiSessionStorage: {
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  loadPiSettings: {
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  loadPiThemeState: {
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  updatePiSetting: {
    key: keyof PiSettings
    value: unknown
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  listConfiguredPiPackages: {
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  installPiPackage: {
    source: string
    kind?: 'npm' | 'git' | undefined
    local?: boolean | undefined
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  removePiPackage: {
    source: string
    local?: boolean | undefined
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  listConfiguredPiSkills: {
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  installPiSkill: {
    source: string
    local?: boolean | undefined
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  removePiSkill: {
    installedPath: string
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  loadThreadSnapshot: { sessionPath: string; historyCompactions?: number | undefined }
  loadSessionTreeList: { sessionPath: string }
  loadThreadPreviewAtEntry: {
    sessionPath: string
    targetEntryId: string
    historyCompactions?: number | undefined
  }
  searchThreadSnapshot: { sessionPath: string; query: string }
  renameThreadSession: { sessionPath: string; name: string }
  generateGitCommitMessage: {
    request: ComposerStateRequest
    context: CommitMessageContext
  }
  setComposerModel: {
    request: ComposerStateRequest
    provider: string
    modelId: string
  }
  setComposerThinkingLevel: {
    request: ComposerStateRequest
    level: ComposerThinkingLevel
  }
  sendComposerPrompt: ComposerStateRequest & {
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior | null
  }
  stopComposerRun: { request: ComposerStateRequest }
  dequeueComposerPrompt: ComposerStateRequest & {
    queueId: string
    queueSnapshotKey: string
    queueMode: Exclude<ComposerStreamingBehavior, 'stop'>
  }
  answerPiExtensionDialog: ComposerStateRequest & {
    requestId: string
    cancelled?: boolean | undefined
    confirmed?: boolean | undefined
    value?: string | undefined
  }
  invokePiExtensionShortcut: ComposerStateRequest & {
    editorSelectionEnd?: number | undefined
    editorSelectionStart?: number | undefined
    editorText?: string | undefined
    shortcut: string
  }
  setProjectTrust: ComposerStateRequest & { cwd: string; trusted: boolean }
  labelSessionTreeEntry: ComposerStateRequest & {
    targetEntryId: string
    label?: string | undefined | null
  }
  navigateSessionTree: ComposerStateRequest & {
    targetEntryId: string
    summarize: boolean
    label?: string | undefined | null
  }
}

export type RuntimeHostResponseMap = {
  getComposerState: ComposerState
  getComposerSlashCommands: ComposerSlashCommand[]
  getComposerSkills: ComposerSkillReference[]
  startNewThread: {
    composer: ComposerState
    projectId: string
    sessionPath: string
    threadId: string
  }
  selectProjectRuntime: ComposerState
  openThreadRuntime: ComposerState
  invalidateRuntimeSettings: { ok: true }
  disposeRuntimeHosts: { ok: true }
  getPiSessionStorage: { agentDir: string; sessionDir: string }
  loadPiSettings: PiSettings
  loadPiThemeState: PiThemeState
  updatePiSetting: PiSettings
  listConfiguredPiPackages: PiConfiguredPackage[]
  installPiPackage: PiPackageMutationResult
  removePiPackage: PiPackageMutationResult
  listConfiguredPiSkills: PiConfiguredSkill[]
  installPiSkill: PiSkillMutationResult
  removePiSkill: PiSkillMutationResult
  loadThreadSnapshot: {
    projectId: string
    threadId: string
    thread: ThreadData
  }
  loadSessionTreeList: SessionTreeList
  loadThreadPreviewAtEntry: {
    projectId: string
    threadId: string
    thread: ThreadData
  }
  searchThreadSnapshot: ThreadSearchResult
  renameThreadSession: { projectId: string; threadId: string; title: string }
  generateGitCommitMessage: string | null
  setComposerModel: { ok: true }
  setComposerThinkingLevel: { ok: true }
  sendComposerPrompt: {
    outcome: 'sent' | 'stopped'
    sessionPath: string | null
    threadId: string | null
  }
  stopComposerRun: { ok: true }
  dequeueComposerPrompt: string | null
  answerPiExtensionDialog: { ok: boolean }
  invokePiExtensionShortcut: {
    editorSelectionEnd?: number | undefined
    editorSelectionStart?: number | undefined
    editorText?: string | undefined
    ok: boolean
  }
  setProjectTrust: { ok: true }
  labelSessionTreeEntry: { ok: true }
  navigateSessionTree: {
    cancelled: boolean
    aborted?: boolean
    editorText?: string
  }
}

export type RuntimeHostMainRequestMap = {
  createArtifact: {
    conversationId: string
    slug: string
    kind: ArtifactKind
    content: string
  }
  updateArtifact: {
    slug: string
    content: string
    conversationId?: string | undefined | null | undefined
  }
  editArtifact: {
    slug: string
    conversationId?: string | undefined | null | undefined
    edits: Array<{ oldText: string; newText: string }>
  }
  getArtifact: { artifactSlug: string; conversationId?: string | undefined | null | undefined }
  listArtifacts: { conversationId: string }
}

export type RuntimeHostMainResponseMap = {
  createArtifact: Artifact
  updateArtifact: Artifact
  editArtifact: Artifact
  getArtifact: Artifact | null
  listArtifacts: Artifact[]
}

export type RuntimeHostMainRequestName = keyof RuntimeHostMainRequestMap

export type RuntimeHostRequestName = keyof RuntimeHostRequestMap

export type RuntimeHostRequestMessage<
  TName extends RuntimeHostRequestName = RuntimeHostRequestName,
> = {
  type: 'request'
  id: string
  name: TName
  payload: RuntimeHostRequestMap[TName]
}

export type RuntimeHostMainRequestMessage<
  TName extends RuntimeHostMainRequestName = RuntimeHostMainRequestName,
> = {
  type: 'main-request'
  id: string
  name: TName
  payload: RuntimeHostMainRequestMap[TName]
}

export type RuntimeHostMainResponseMessage =
  | {
      type: 'main-response'
      id: string
      ok: true
      result: RuntimeHostMainResponseMap[RuntimeHostMainRequestName]
    }
  | {
      type: 'main-response'
      id: string
      ok: false
      error: string
      stack?: string | undefined
    }

export type { RuntimeHostToMainMessage } from './runtime-host-ipc-schema.ts'

export type RuntimeMainToHostMessage = RuntimeHostRequestMessage | RuntimeHostMainResponseMessage
