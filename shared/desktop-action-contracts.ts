import type { DesktopAction } from './desktop-actions'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  GitOpsMode,
  PiSettings,
  ProjectDeletionMode,
  ProjectDiffBaseline,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
  ProjectImportCandidate,
} from './desktop-data-contracts'

type EmptyActionPayload = Record<string, never>

export type DesktopActionPayloadFields = {
  attachments?: ComposerAttachment[]
  composerMode?: 'chat' | 'code' | null
  chatGroupId?: string | undefined | null | undefined
  chatGroupIds?: string[] | undefined
  folders?: string[] | undefined
  imported?: boolean | undefined | null
  gitOpsMode?: GitOpsMode | null
  diffBaseline?: ProjectDiffBaseline | null
  diffRenderMode?: ProjectDiffRenderMode | null
  includeUnstaged?: boolean | undefined
  includeUntracked?: boolean | undefined
  key?: keyof AppSettings
  piSettingsKey?: keyof PiSettings
  level?: ComposerThinkingLevel
  message?: string | undefined | null | undefined
  modelId?: string | undefined
  olderThanDays?: number | undefined | null | undefined
  preview?: boolean | undefined
  projectId?: string | undefined | null | undefined
  projectIds?: string[] | undefined
  projectName?: string | undefined
  projectPath?: string | undefined
  parentPath?: string | undefined
  createIfMissing?: boolean | undefined
  provider?: string | undefined
  queueId?: string | undefined
  answers?: string[][] | undefined | null
  requestId?: string | undefined
  queueSnapshotKey?: string | undefined
  push?: boolean | undefined
  queueIndex?: number | undefined
  queueMode?: Exclude<ComposerStreamingBehavior | undefined, 'stop'>
  repoUrl?: string | undefined | null | undefined
  reset?: boolean | undefined
  sessionPath?: string | undefined | null | undefined
  streamingBehavior?: ComposerStreamingBehavior
  text?: string | undefined
  threadId?: string | undefined
  threadIds?: string[] | undefined
  branchName?: string | undefined | null | undefined
  value?:
    | string
    | undefined
    | number
    | boolean
    | ProjectDiffDefaultBaseline
    | AppSettings['keybindings']
    | null
}

export type DesktopActionPayloadInput = {
  [Key in keyof DesktopActionPayloadFields]?: unknown
}

export type DesktopSettingsUpdatePayload =
  | { key: 'chatModel'; provider: string; modelId: string; reset?: false }
  | { key: 'chatModel'; reset: true }
  | { key: 'chatThinkingLevel'; value: ComposerThinkingLevel }
  | { key: 'chatThinkingLevel'; reset: true }
  | { key: 'codeModel'; provider: string; modelId: string; reset?: false }
  | { key: 'codeModel'; reset: true }
  | { key: 'codeThinkingLevel'; value: ComposerThinkingLevel }
  | { key: 'codeThinkingLevel'; reset: true }
  | { key: 'gitCommitMessageModel'; provider: string; modelId: string; reset?: false }
  | { key: 'gitCommitMessageModel'; reset: true }
  | { key: 'gitCommitMessageThinkingLevel'; value: ComposerThinkingLevel }
  | { key: 'skillCreatorModel'; provider: string; modelId: string; reset?: false }
  | { key: 'skillCreatorModel'; reset: true }
  | { key: 'skillCreatorThinkingLevel'; value: ComposerThinkingLevel }
  | { key: 'composerStreamingBehavior'; value: ComposerStreamingBehavior }
  | { key: 'dictationModelId'; value: DictationModelId | null }
  | { key: 'dictationMaxDurationSeconds'; value: number }
  | { key: 'showDictationButton'; value: boolean }
  | { key: 'favoriteFolders'; folders: string[] }
  | { key: 'projectImportState'; imported: boolean | null }
  | { key: 'preferredProjectLocation'; value: string | null }
  | { key: 'customPiDirectory'; value: string | null }
  | { key: 'initializeGitOnProjectCreate'; value: boolean }
  | { key: 'projectDashboardEnabled'; value: boolean }
  | { key: 'gitOpsDefaultMode'; value: GitOpsMode }
  | { key: 'gitDiffBaselineDefault'; value: ProjectDiffDefaultBaseline }
  | { key: 'gitDiffRenderModeDefault'; value: ProjectDiffRenderMode }
  | { key: 'gitDiffFileTreeDefaultVisible'; value: boolean }
  | { key: 'gitDiffIncludeUntrackedDefault'; value: boolean }
  | { key: 'projectDeletionMode'; value: ProjectDeletionMode }
  | { key: 'useAgentsSkillsPaths'; value: boolean }
  | { key: 'howcodeNativeAskQuestions'; value: boolean }
  | { key: 'devUpdateBranch'; value: boolean }
  | { key: 'betaUpdateBranch'; value: boolean }
  | { key: 'piTuiTakeover'; value: boolean }
  | { key: 'hoverToFocus'; value: boolean }
  | { key: 'hoverToBlur'; value: boolean }
  | { key: 'keybindings'; value: AppSettings['keybindings'] }
  | { key: 'composerSendMode'; value: AppSettings['composerSendMode'] }

export type DesktopActionPayloadMap = {
  'threads.collapse-all': EmptyActionPayload
  'project.add': {
    projectName?: string | undefined
    projectPath?: string | undefined
    parentPath?: string | undefined
    createIfMissing?: boolean | undefined
    repoUrl?: string | undefined | null | undefined
  }
  'project.select': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
  }
  'project.expand': { projectId: string }
  'project.collapse': { projectId: string }
  'project.open-in-file-manager': { projectId: string }
  'project.reorder': { projectIds: string[] }
  'project.pin': { projectId: string }
  'project.edit-name': { projectId: string; projectName: string }
  'project.refresh-repo-origin': { projectId: string }
  'project.archive-threads': { projectId: string; projectName?: string | undefined }
  'project.remove-project': { projectId: string; projectName?: string | undefined }
  'chat.group.create': {
    chatGroupId?: string | undefined | null | undefined
    value?: string | undefined | null | undefined
  }
  'chat.group.rename': { chatGroupId: string; value: string }
  'chat.group.reorder': { chatGroupIds: string[] }
  'chat.group.collapse': { chatGroupId: string; value: boolean }
  'chat.thread.move': {
    threadId: string
    sessionPath?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
  }
  'thread.new': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
  }
  'thread.open': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    threadId?: string | undefined
  }
  'thread.archive': { threadId: string }
  'thread.archive-many': { projectId?: string | undefined | null | undefined; threadIds: string[] }
  'thread.assign-branch': {
    threadId: string
    projectId?: string | undefined | null | undefined
    branchName?: string | undefined | null | undefined
  }
  'thread.restore': { threadId: string }
  'thread.restore-many': { threadIds: string[]; projectIds?: string[] | undefined }
  'thread.delete': { threadId: string }
  'thread.delete-many': { threadIds: string[]; projectIds?: string[] | undefined }
  'thread.pin': { threadId: string; projectId?: string | undefined | null | undefined }
  'workspace.commit': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    includeUnstaged?: boolean | undefined
    includeUntracked?: boolean | undefined
    message?: string | undefined | null | undefined
    preview?: boolean | undefined
    push?: boolean | undefined
  }
  'workspace.commit-options': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    repoUrl?: string | undefined | null | undefined
    gitOpsMode?: GitOpsMode | null
  }
  'workspace.diff-preferences': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    diffBaseline?: ProjectDiffBaseline | null
    diffRenderMode?: ProjectDiffRenderMode | null
  }
  'workspace.switch-branch': { projectId?: string | undefined | null | undefined; value: string }
  'workspace.prune-branch': {
    projectId?: string | undefined | null | undefined
    branchName: string
  }
  'composer.model': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    provider: string
    modelId: string
  }
  'composer.thinking': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    level: ComposerThinkingLevel
  }
  'composer.send': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    chatGroupId?: string | undefined | null | undefined
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior
  }
  'composer.stop': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
  }
  'composer.dequeue': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    queueId: string
    queueSnapshotKey: string
    queueMode: Exclude<ComposerStreamingBehavior, 'stop'>
  }
  'composer.reload-settings': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
  }
  'composer.answer-native-questions': {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
    composerMode?: 'chat' | 'code' | null
    chatGroupId?: string | undefined | null | undefined
    requestId: string
    answers: string[][] | null
  }
  'inbox.mark-read': { sessionPath: string; projectId?: string | undefined | null | undefined }
  'inbox.dismiss': { sessionPath: string; projectId?: string | undefined | null | undefined }
  'inbox.clear-read': { olderThanDays?: number | undefined | null | undefined }
  'settings.update': DesktopSettingsUpdatePayload
  'settings.clear-clipboard-images': EmptyActionPayload
  'pi-settings.update': { piSettingsKey: keyof PiSettings; value: string | number | boolean }
  'projects.import.scan': { projectIds: string[] }
  'projects.import.apply': { projectIds: string[] }
}

export type AnyDesktopActionPayload = DesktopActionPayloadInput

export type DesktopActionPayload<A extends DesktopAction = DesktopAction> =
  DesktopActionPayloadMap[A]

export type DesktopActionResultData = {
  checkedProjectCount?: number | undefined
  clearedCount?: number | undefined
  clearFailedCount?: number | undefined
  committed?: boolean | undefined
  composer?: ComposerState
  composerSendOutcome?: 'sent' | 'stopped'
  composerSendSessionPath?: string | undefined | null | undefined
  composerSendThreadId?: string | undefined | null | undefined
  dequeuedText?: string | undefined | null | undefined
  deletedThreadIds?: string[] | undefined
  didMutate?: boolean | undefined
  error?: string | undefined
  failedThreadIds?: string[] | undefined
  importedProjectIds?: string[] | undefined
  message?: string | undefined | null | undefined
  originProjectCount?: number | undefined
  originUrl?: string | undefined | null | undefined
  piSettings?: PiSettings
  previewed?: boolean | undefined
  projectId?: string | undefined
  projects?: ProjectImportCandidate[]
  pushed?: boolean | undefined
  pushFailed?: boolean | undefined
  repoProjectCount?: number | undefined
  sessionPath?: string | undefined | null | undefined
  threadId?: string | undefined
}

export type DesktopActionInvoker = (
  action: DesktopAction,
  payload?: DesktopActionPayloadInput | undefined,
) => Promise<DesktopActionResult | null>

export type DesktopActionResult<A extends DesktopAction = DesktopAction> = {
  ok: boolean
  at: string
  payload: {
    action: A
    payload: AnyDesktopActionPayload
  }
  result?: DesktopActionResultData | null
}
