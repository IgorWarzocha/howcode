import type { DesktopAction } from './desktop-actions'
import type { ComposerExtensionSelection } from './desktop-composer-contracts'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  DirectoryDeletionMode,
  DirectoryDiffBaseline,
  DirectoryDiffDefaultBaseline,
  DirectoryDiffRenderMode,
  DirectoryFileWriteResult,
  DirectoryImportCandidate,
  GitOpsMode,
  PiSettings,
  PiThemeState,
  WorkingDirectory,
} from './desktop-data-contracts'
import type { ToolkitComponentId } from './toolkit-components'

type EmptyActionPayload = Record<string, never>

export type DesktopActionPayloadFields = {
  composerExtensions?: ComposerExtensionSelection
  attachments?: ComposerAttachment[]
  composerProfile?: 'general' | 'coding' | null
  workspaceId?: string | undefined | null | undefined
  workspaceIds?: string[] | undefined
  folders?: string[] | undefined
  imported?: boolean | undefined | null
  gitOpsMode?: GitOpsMode | null
  diffBaseline?: DirectoryDiffBaseline | null
  diffRenderMode?: DirectoryDiffRenderMode | null
  includeUnstaged?: boolean | undefined
  includeUntracked?: boolean | undefined
  key?: keyof AppSettings
  piSettingsKey?: keyof PiSettings
  level?: ComposerThinkingLevel
  message?: string | undefined | null | undefined
  modelId?: string | undefined
  olderThanDays?: number | undefined | null | undefined
  preview?: boolean | undefined
  directoryId?: string | undefined | null | undefined
  directoryIds?: string[] | undefined
  directoryName?: string | undefined
  directoryPath?: string | undefined
  rootDirectoryId?: string | undefined
  parentPath?: string | undefined
  worktreeDirectory?: string | undefined | null | undefined
  worktreePath?: string | undefined | null | undefined
  worktrees?: { worktreePath: string }[] | undefined
  createIfMissing?: boolean | undefined
  cwd?: string | undefined
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText?: string | undefined
  fileContents?: string | undefined
  filePath?: string | undefined
  expectedRevision?: string | undefined
  provider?: string | undefined
  queueId?: string | undefined
  answers?: string[][] | undefined | null
  requestId?: string | undefined
  confirmed?: boolean | undefined
  cancelled?: boolean | undefined
  queueSnapshotKey?: string | undefined
  push?: boolean | undefined
  queueIndex?: number | undefined
  queueMode?: Exclude<ComposerStreamingBehavior | undefined, 'stop'>
  repoUrl?: string | undefined | null | undefined
  reset?: boolean | undefined
  conversationId?: string | undefined | null | undefined
  shortcut?: string | undefined
  summarize?: boolean | undefined
  streamingBehavior?: ComposerStreamingBehavior
  suppressInbox?: boolean | undefined | null | undefined
  targetEntryId?: string | undefined
  text?: string | undefined
  trusted?: boolean | undefined
  chatId?: string | undefined
  chatIds?: string[] | undefined
  branchName?: string | undefined | null | undefined
  label?: string | undefined | null | undefined
  value?:
    | string
    | undefined
    | number
    | boolean
    | DirectoryDiffDefaultBaseline
    | AppSettings['keybindings']
    | string[]
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
  | { key: 'composerStreamingBehavior'; value: ComposerStreamingBehavior }
  | { key: 'dictationModelId'; value: DictationModelId | null }
  | { key: 'dictationMaxDurationSeconds'; value: number }
  | { key: 'showDictationButton'; value: boolean }
  | { key: 'enabledToolkitComponents'; value: readonly ToolkitComponentId[] }
  | { key: 'favoriteFolders'; folders: string[] }
  | { key: 'directoryImportState'; imported: boolean | null }
  | { key: 'preferredDirectoryLocation'; value: string | null }
  | { key: 'customPiDirectory'; value: string | null }
  | { key: 'initializeGitOnDirectoryCreate'; value: boolean }
  | { key: 'directoryDashboardEnabled'; value: boolean }
  | { key: 'gitOpsDefaultMode'; value: GitOpsMode }
  | { key: 'gitDiffBaselineDefault'; value: DirectoryDiffDefaultBaseline }
  | { key: 'gitDiffRenderModeDefault'; value: DirectoryDiffRenderMode }
  | { key: 'gitDiffFileTreeDefaultVisible'; value: boolean }
  | { key: 'gitDiffIncludeUntrackedDefault'; value: boolean }
  | { key: 'directoryDeletionMode'; value: DirectoryDeletionMode }
  | { key: 'useAgentsSkillsPaths'; value: boolean }
  | { key: 'hideSidebarSessionCounts'; value: boolean }
  | { key: 'hoverToFocus'; value: boolean }
  | { key: 'hoverToBlur'; value: boolean }
  | { key: 'keybindings'; value: AppSettings['keybindings'] }
  | { key: 'composerSendMode'; value: AppSettings['composerSendMode'] }

export type DesktopActionPayloadMap = {
  'chats.collapse-all': EmptyActionPayload
  'directory.add': {
    directoryName?: string | undefined
    directoryPath?: string | undefined
    parentPath?: string | undefined
    createIfMissing?: boolean | undefined
    repoUrl?: string | undefined | null | undefined
  }
  'directory.select': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
  }
  'directory.expand': { directoryId: string }
  'directory.collapse': { directoryId: string }
  'directory.pin': { directoryId: string }
  'directory.edit-name': { directoryId: string; directoryName: string }
  'directory.refresh-repo-origin': { directoryId: string }
  'directory.archive-chats': { directoryId: string; directoryName?: string | undefined }
  'directory.remove': { directoryId: string; directoryName?: string | undefined }
  'workspace.create': {
    workspaceId?: string | undefined | null | undefined
    value?: string | undefined | null | undefined
  }
  'workspace.rename': { workspaceId: string; value: string }
  'workspace.reorder': { workspaceIds: string[] }
  'workspace.collapse': { workspaceId: string; value: boolean }
  'chat.move': {
    chatId: string
    conversationId?: string | undefined | null | undefined
    workspaceId?: string | undefined | null | undefined
  }
  'chat.new': {
    composerExtensions?: ComposerExtensionSelection
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    workspaceId?: string | undefined | null | undefined
    branchName?: string | undefined | null | undefined
  }
  'chat.open': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    chatId?: string | undefined
    composerProfile?: 'general' | 'coding' | null
    branchName?: string | undefined | null | undefined
  }
  'chat.archive': { chatId: string }
  'chat.archive-many': { directoryId?: string | undefined | null | undefined; chatIds: string[] }
  'chat.assign-branch': {
    chatId: string
    directoryId?: string | undefined | null | undefined
    branchName?: string | undefined | null | undefined
  }
  'chat.restore': { chatId: string }
  'chat.restore-many': { chatIds: string[]; directoryIds?: string[] | undefined }
  'chat.delete': { chatId: string }
  'chat.delete-many': { chatIds: string[]; directoryIds?: string[] | undefined }
  'chat.pin': { chatId: string; directoryId?: string | undefined | null | undefined }
  'chat.rename': {
    chatId: string
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    value: string
  }
  'git.commit': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    includeUnstaged?: boolean | undefined
    includeUntracked?: boolean | undefined
    message?: string | undefined | null | undefined
    preview?: boolean | undefined
    push?: boolean | undefined
  }
  'git.commit-options': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    repoUrl?: string | undefined | null | undefined
    gitOpsMode?: GitOpsMode | null
  }
  'git.diff-preferences': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    diffBaseline?: DirectoryDiffBaseline | null
    diffRenderMode?: DirectoryDiffRenderMode | null
  }
  'git.write-file': {
    directoryId: string
    filePath: string
    fileContents: string
    expectedRevision: string
  }
  'directory.sidebar-scope': { directoryIds: string[] }
  'git.switch-branch': { directoryId?: string | undefined | null | undefined; value: string }
  'worktrees.prune-branch': {
    rootDirectoryId: string
    branchName: string
  }
  'worktrees.create-worktree': {
    rootDirectoryId: string
    branchName: string
    worktreeDirectory?: string | undefined | null | undefined
  }
  'worktrees.remove-worktree': {
    rootDirectoryId: string
    worktreePath: string
  }
  'worktrees.mark-worktree-complete': {
    rootDirectoryId: string
    worktreePath: string
  }
  'worktrees.mark-worktree-incomplete': {
    rootDirectoryId: string
    worktreePath: string
  }
  'worktrees.merge-worktree': {
    rootDirectoryId: string
    worktreePath: string
  }
  'worktrees.merge-completed-worktrees': {
    rootDirectoryId: string
    worktrees: { worktreePath: string }[]
  }
  'worktrees.remove-completed-worktrees': {
    rootDirectoryId: string
    worktrees: { worktreePath: string }[]
  }
  'worktrees.set-worktree-directory': {
    rootDirectoryId: string
    worktreeDirectory: string
  }
  'composer.model': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    provider: string
    modelId: string
  }
  'composer.thinking': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    level: ComposerThinkingLevel
  }
  'composer.send': {
    composerExtensions?: ComposerExtensionSelection
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    workspaceId?: string | undefined | null | undefined
    suppressInbox?: boolean | undefined | null | undefined
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior
  }
  'composer.stop': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
  }
  'composer.dequeue': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    queueId: string
  }
  'composer.reload-settings': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
  }
  'composer.conversation.fork': {
    directoryId?: string | undefined | null | undefined
    conversationId?: string | undefined | null | undefined
    composerProfile?: 'general' | 'coding' | null
    workspaceId?: string | undefined | null | undefined
    targetEntryId: string
  }
  'inbox.mark-read': { conversationId: string; directoryId?: string | undefined | null | undefined }
  'inbox.dismiss': { conversationId: string; directoryId?: string | undefined | null | undefined }
  'inbox.clear-read': { olderThanDays?: number | undefined | null | undefined }
  'settings.update': DesktopSettingsUpdatePayload
  'pi-settings.update': {
    piSettingsKey: keyof PiSettings
    value: string | number | boolean | string[]
  }
  'directories.import.scan': { directoryIds: string[] }
  'directories.import.apply': { directoryIds: string[] }
}

export type AnyDesktopActionPayload = DesktopActionPayloadInput

export type DesktopActionPayload<A extends DesktopAction = DesktopAction> =
  DesktopActionPayloadMap[A]

export type DesktopActionResultData = {
  branchName?: string | undefined | null | undefined
  parentBranchName?: string | undefined | null | undefined
  checkedDirectoryCount?: number | undefined
  clearedCount?: number | undefined
  clearFailedCount?: number | undefined
  committed?: boolean | undefined
  composer?: ComposerState
  composerSendOutcome?: 'sent' | 'stopped'
  composerSendConversationId?: string | undefined | null | undefined
  composerSendChatId?: string | undefined | null | undefined
  queueCancelOutcome?: 'aborted' | 'already_placed' | 'already_settled'
  deletedChatIds?: string[] | undefined
  didMutate?: boolean | undefined
  error?: string | undefined
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText?: string | undefined
  failedWorktreeBranchName?: string | undefined | null | undefined
  failedWorktreePath?: string | undefined
  failedChatIds?: string[] | undefined
  fileWrite?: DirectoryFileWriteResult | undefined
  importedDirectoryIds?: string[] | undefined
  importedDirectories?: WorkingDirectory[] | undefined
  message?: string | undefined | null | undefined
  originDirectoryCount?: number | undefined
  originUrl?: string | undefined | null | undefined
  piSettings?: PiSettings
  piTheme?: PiThemeState
  previewed?: boolean | undefined
  affectedDirectoryIds?: string[] | undefined
  directoryId?: string | undefined
  removedWorktreeIds?: string[] | undefined
  rootDirectoryId?: string | undefined
  directories?: DirectoryImportCandidate[]
  pushed?: boolean | undefined
  pushFailed?: boolean | undefined
  repoDirectoryCount?: number | undefined
  conversationId?: string | undefined | null | undefined
  title?: string | undefined
  chatId?: string | undefined
  worktreeRemoved?: boolean | undefined
  worktreeCompleted?: boolean | undefined
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
