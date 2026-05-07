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
  DesktopEvent,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageMutationResult,
  PiSettings,
  PiSkillMutationResult,
  PiThemeState,
  SkillCreatorSessionState,
  ThreadData,
} from '../../shared/desktop-contracts.ts'
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
  startSkillCreatorSession: {
    prompt: string
    local?: boolean | undefined
    projectPath?: string | undefined | null | undefined
    chat?: boolean | undefined
  }
  continueSkillCreatorSession: { sessionId: string; prompt: string }
  closeSkillCreatorSession: { sessionId: string }
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
  answerNativeAskQuestions: ComposerStateRequest & {
    requestId: string
    answers: string[][] | null
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
  startSkillCreatorSession: SkillCreatorSessionState
  continueSkillCreatorSession: SkillCreatorSessionState
  closeSkillCreatorSession: { ok: boolean }
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
  answerNativeAskQuestions: { ok: boolean }
}

export type RuntimeHostMainRequestMap = {
  getSessionNativeExtensions: { sessionPath: string }
  setSessionNativeExtensions: { sessionPath: string; enabled: string[] }
  snapshotDefaultNativeExtensions: Record<string, never>
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
  getSessionNativeExtensions: string[] | null
  setSessionNativeExtensions: { ok: true }
  snapshotDefaultNativeExtensions: string[]
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

export type RuntimeHostResponseMessage =
  | {
      type: 'response'
      id: string
      ok: true
      result: RuntimeHostResponseMap[RuntimeHostRequestName]
    }
  | { type: 'response'; id: string; ok: false; error: string; stack?: string | undefined }

export type RuntimeHostEventMessage = {
  type: 'desktop-event'
  event: DesktopEvent
}

export type RuntimeHostCrashMessage = {
  type: 'host-error'
  error: string
  stack?: string | undefined
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

export type RuntimeHostToMainMessage =
  | RuntimeHostResponseMessage
  | RuntimeHostEventMessage
  | RuntimeHostCrashMessage
  | RuntimeHostMainRequestMessage

export type RuntimeMainToHostMessage = RuntimeHostRequestMessage | RuntimeHostMainResponseMessage
