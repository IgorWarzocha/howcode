import { isComposerThinkingLevel } from './composer-thinking-level'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  DesktopActionPayloadInput,
  DictationModelId,
  GitOpsMode,
  ModelSelection,
  ProjectDeletionMode,
  ProjectDiffBaseline,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
  ProjectFileWriteRequest,
} from './desktop-contracts'
import { getLocalDraftBranchName, getPersistedSessionPath } from './session-paths'

export function getComposerRequest(payload: DesktopActionPayloadInput): ComposerStateRequest {
  return {
    projectId: typeof payload.projectId === 'string' ? payload.projectId : null,
    sessionPath: getPersistedSessionPath(
      typeof payload.sessionPath === 'string' ? payload.sessionPath : null,
    ),
    composerMode:
      payload.composerMode === 'chat' || payload.composerMode === 'code'
        ? payload.composerMode
        : null,
    chatGroupId: typeof payload.chatGroupId === 'string' ? payload.chatGroupId : null,
    branchName:
      typeof payload.branchName === 'string'
        ? payload.branchName
        : getLocalDraftBranchName(
            typeof payload.sessionPath === 'string' ? payload.sessionPath : null,
          ),
  }
}

export function getProjectId(payload: DesktopActionPayloadInput) {
  return typeof payload.projectId === 'string' ? payload.projectId : null
}

export function getRootProjectId(payload: DesktopActionPayloadInput) {
  return typeof payload.rootProjectId === 'string' ? payload.rootProjectId : null
}

export function getProjectFileWriteRequest(
  payload: DesktopActionPayloadInput,
): ProjectFileWriteRequest | null {
  if (
    typeof payload.projectId !== 'string' ||
    typeof payload.filePath !== 'string' ||
    typeof payload.fileContents !== 'string' ||
    typeof payload.expectedRevision !== 'string' ||
    payload.projectId.length === 0 ||
    payload.filePath.length === 0 ||
    payload.expectedRevision.length === 0
  ) {
    return null
  }

  return {
    projectId: payload.projectId,
    path: payload.filePath,
    contents: payload.fileContents,
    expectedRevision: payload.expectedRevision,
  }
}

export function getSessionPath(payload: DesktopActionPayloadInput) {
  return typeof payload.sessionPath === 'string' ? payload.sessionPath : null
}

export function getThreadId(payload: DesktopActionPayloadInput) {
  return typeof payload.threadId === 'string' ? payload.threadId : null
}

export function getThreadIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.threadIds)
    ? payload.threadIds.filter(
        (threadId: unknown): threadId is string => typeof threadId === 'string',
      )
    : []
}

export function getBranchName(payload: DesktopActionPayloadInput) {
  const branchName = typeof payload.branchName === 'string' ? payload.branchName.trim() : ''
  return branchName.length > 0 ? branchName : null
}

export function getWorktreeDirectory(payload: DesktopActionPayloadInput) {
  const worktreeDirectory =
    typeof payload.worktreeDirectory === 'string' ? payload.worktreeDirectory.trim() : ''
  return worktreeDirectory.length > 0 ? worktreeDirectory : null
}

export function getWorktreePath(payload: DesktopActionPayloadInput) {
  const worktreePath = typeof payload.worktreePath === 'string' ? payload.worktreePath.trim() : ''
  return worktreePath.length > 0 ? worktreePath : null
}

export type WorktreeActionTarget = {
  worktreePath: string
}

export function getWorktreeActionTargets(
  payload: DesktopActionPayloadInput,
): WorktreeActionTarget[] {
  if (!Array.isArray(payload.worktrees)) return []

  return payload.worktrees.flatMap((target): WorktreeActionTarget[] => {
    if (typeof target !== 'object' || target === null) return []
    const candidate = target as { worktreePath?: unknown }
    const worktreePath =
      typeof candidate.worktreePath === 'string' ? candidate.worktreePath.trim() : ''
    if (!worktreePath) return []
    return [{ worktreePath }]
  })
}

export function getProjectName(payload: DesktopActionPayloadInput) {
  const projectName = typeof payload.projectName === 'string' ? payload.projectName.trim() : ''
  return projectName.length > 0 ? projectName : null
}

export function getProjectIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.projectIds)
    ? payload.projectIds.filter(
        (projectId: unknown): projectId is string => typeof projectId === 'string',
      )
    : []
}

export function getComposerText(payload: DesktopActionPayloadInput) {
  return typeof payload.text === 'string' ? payload.text.trim() : ''
}

export function getComposerAttachments(payload: DesktopActionPayloadInput): ComposerAttachment[] {
  return Array.isArray(payload.attachments)
    ? payload.attachments.filter((attachment: unknown): attachment is ComposerAttachment => {
        if (typeof attachment !== 'object' || attachment === null) {
          return false
        }

        const candidate = attachment as Partial<ComposerAttachment>
        return (
          typeof candidate.path === 'string' &&
          typeof candidate.name === 'string' &&
          (candidate.kind === 'directory' ||
            candidate.kind === 'text' ||
            candidate.kind === 'image')
        )
      })
    : []
}

export function getComposerStreamingBehavior(
  payload: DesktopActionPayloadInput,
): ComposerStreamingBehavior | null {
  return payload.streamingBehavior === 'steer' ||
    payload.streamingBehavior === 'followUp' ||
    payload.streamingBehavior === 'stop'
    ? payload.streamingBehavior
    : null
}

export function getComposerQueueMode(payload: DesktopActionPayloadInput) {
  return payload.queueMode === 'steer' || payload.queueMode === 'followUp'
    ? payload.queueMode
    : null
}

export function getComposerQueueId(payload: DesktopActionPayloadInput) {
  return typeof payload.queueId === 'string' && payload.queueId.length > 0 ? payload.queueId : null
}

export function getComposerQueueSnapshotKey(payload: DesktopActionPayloadInput) {
  return typeof payload.queueSnapshotKey === 'string' && payload.queueSnapshotKey.length > 0
    ? payload.queueSnapshotKey
    : null
}

export function getComposerQueueIndex(payload: DesktopActionPayloadInput) {
  return typeof payload.queueIndex === 'number' && Number.isInteger(payload.queueIndex)
    ? payload.queueIndex
    : null
}

export function getComposerModelSelection(payload: DesktopActionPayloadInput) {
  const provider = typeof payload.provider === 'string' ? payload.provider : null
  const modelId = typeof payload.modelId === 'string' ? payload.modelId : null

  return provider && modelId ? { provider, modelId } : null
}

export function getComposerThinkingLevel(payload: DesktopActionPayloadInput) {
  const level = typeof payload.level === 'string' ? payload.level : null
  return isComposerThinkingLevel(level) ? level : null
}

export function getGitCommitMessage(payload: DesktopActionPayloadInput) {
  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  return message.length > 0 ? message : null
}

export function getGitIncludeUnstaged(payload: DesktopActionPayloadInput) {
  return typeof payload.includeUnstaged === 'boolean' ? payload.includeUnstaged : true
}

export function getGitIncludeUntracked(payload: DesktopActionPayloadInput) {
  return typeof payload.includeUntracked === 'boolean' ? payload.includeUntracked : false
}

export function getGitPush(payload: DesktopActionPayloadInput) {
  return typeof payload.push === 'boolean' ? payload.push : false
}

export function getGitPreview(payload: DesktopActionPayloadInput) {
  return payload.preview === true
}

export function getGitRepoUrl(payload: DesktopActionPayloadInput) {
  const repoUrl = typeof payload.repoUrl === 'string' ? payload.repoUrl.trim() : ''
  return repoUrl.length > 0 ? repoUrl : null
}

export function getGitOpsMode(
  payload: DesktopActionPayloadInput,
): GitOpsMode | null | undefined | 'invalid' {
  if (!('gitOpsMode' in payload) || payload.gitOpsMode === undefined) {
    return undefined
  }

  if (payload.gitOpsMode === null) {
    return null
  }

  return payload.gitOpsMode === 'commit' || payload.gitOpsMode === 'commit-push'
    ? payload.gitOpsMode
    : 'invalid'
}

function isProjectDiffBaseline(value: unknown): value is ProjectDiffBaseline {
  if (!value || typeof value !== 'object') {
    return false
  }

  const baseline = value as { branchName?: unknown; kind?: unknown; rev?: unknown; sha?: unknown }
  switch (baseline.kind) {
    case 'head':
    case 'previous':
    case 'main-branch':
    case 'dev-branch':
      return true
    case 'parent-branch':
    case 'branch':
      return typeof baseline.branchName === 'string' && baseline.branchName.trim().length > 0
    case 'last-opened':
      return typeof baseline.rev === 'string' && baseline.rev.trim().length > 0
    case 'commit':
      return typeof baseline.sha === 'string' && baseline.sha.trim().length > 0
    default:
      return false
  }
}

export function getProjectDiffBaselinePreference(
  payload: DesktopActionPayloadInput,
): ProjectDiffBaseline | null | undefined | 'invalid' {
  if (!('diffBaseline' in payload) || payload.diffBaseline === undefined) {
    return undefined
  }

  if (payload.diffBaseline === null) {
    return null
  }

  return isProjectDiffBaseline(payload.diffBaseline) ? payload.diffBaseline : 'invalid'
}

export function getProjectDiffRenderModePreference(
  payload: DesktopActionPayloadInput,
): ProjectDiffRenderMode | null | undefined | 'invalid' {
  if (!('diffRenderMode' in payload) || payload.diffRenderMode === undefined) {
    return undefined
  }

  if (payload.diffRenderMode === null) {
    return null
  }

  return payload.diffRenderMode === 'stacked' || payload.diffRenderMode === 'split'
    ? payload.diffRenderMode
    : 'invalid'
}

export function getSettingsProjectDiffBaselineDefault(
  payload: DesktopActionPayloadInput,
): ProjectDiffDefaultBaseline | null {
  return isProjectDiffBaseline(payload.value) &&
    (payload.value.kind === 'head' ||
      payload.value.kind === 'previous' ||
      payload.value.kind === 'main-branch' ||
      payload.value.kind === 'dev-branch')
    ? payload.value
    : null
}

export function getSettingsProjectDiffRenderModeDefault(
  payload: DesktopActionPayloadInput,
): ProjectDiffRenderMode | null {
  return payload.value === 'stacked' || payload.value === 'split' ? payload.value : null
}

export function getSettingsKey(payload: DesktopActionPayloadInput) {
  return payload.key === 'chatModel' ||
    payload.key === 'chatThinkingLevel' ||
    payload.key === 'codeModel' ||
    payload.key === 'codeThinkingLevel' ||
    payload.key === 'gitCommitMessageModel' ||
    payload.key === 'gitCommitMessageThinkingLevel' ||
    payload.key === 'composerStreamingBehavior' ||
    payload.key === 'dictationModelId' ||
    payload.key === 'dictationMaxDurationSeconds' ||
    payload.key === 'showDictationButton' ||
    payload.key === 'favoriteFolders' ||
    payload.key === 'projectImportState' ||
    payload.key === 'preferredProjectLocation' ||
    payload.key === 'customPiDirectory' ||
    payload.key === 'initializeGitOnProjectCreate' ||
    payload.key === 'projectDashboardEnabled' ||
    payload.key === 'gitOpsDefaultMode' ||
    payload.key === 'gitDiffBaselineDefault' ||
    payload.key === 'gitDiffRenderModeDefault' ||
    payload.key === 'gitDiffFileTreeDefaultVisible' ||
    payload.key === 'gitDiffIncludeUntrackedDefault' ||
    payload.key === 'projectDeletionMode' ||
    payload.key === 'useAgentsSkillsPaths' ||
    payload.key === 'devUpdateBranch' ||
    payload.key === 'betaUpdateBranch' ||
    payload.key === 'piTuiTakeover' ||
    payload.key === 'hideSidebarSessionCounts' ||
    payload.key === 'hoverToFocus' ||
    payload.key === 'hoverToBlur' ||
    payload.key === 'keybindings' ||
    payload.key === 'composerSendMode'
    ? (payload.key as keyof AppSettings)
    : null
}

export function getPiExtensionRequestId(payload: DesktopActionPayloadInput) {
  return typeof payload.requestId === 'string' ? payload.requestId : null
}

export function getPiExtensionShortcut(payload: DesktopActionPayloadInput) {
  return typeof payload.shortcut === 'string' ? payload.shortcut : null
}

export function getPiExtensionEditorState(payload: DesktopActionPayloadInput) {
  return {
    editorSelectionEnd:
      typeof payload.editorSelectionEnd === 'number' ? payload.editorSelectionEnd : undefined,
    editorSelectionStart:
      typeof payload.editorSelectionStart === 'number' ? payload.editorSelectionStart : undefined,
    editorText: typeof payload.editorText === 'string' ? payload.editorText : undefined,
  }
}

export function getPiExtensionDialogAnswer(payload: DesktopActionPayloadInput) {
  return {
    cancelled: payload.cancelled === true,
    confirmed: payload.confirmed === true,
    value: typeof payload.value === 'string' ? payload.value : undefined,
  }
}

export function getProjectTrustDecision(payload: DesktopActionPayloadInput) {
  return typeof payload.trusted === 'boolean' ? payload.trusted : null
}

export function getProjectTrustCwd(payload: DesktopActionPayloadInput) {
  return typeof payload.cwd === 'string' && payload.cwd.length > 0 ? payload.cwd : null
}

export function getSessionTreeNavigate(payload: DesktopActionPayloadInput) {
  const targetEntryId =
    typeof payload.targetEntryId === 'string' ? payload.targetEntryId.trim() : ''
  if (!targetEntryId) return null
  return {
    targetEntryId,
    summarize: payload.summarize === true,
    label: typeof payload.label === 'string' ? payload.label.trim() : '',
  }
}

export function getSessionTreeLabel(payload: DesktopActionPayloadInput) {
  const targetEntryId =
    typeof payload.targetEntryId === 'string' ? payload.targetEntryId.trim() : ''
  if (!targetEntryId) return null
  return {
    targetEntryId,
    label: typeof payload.label === 'string' ? payload.label.trim() : '',
  }
}

export function getSettingsThinkingLevel(payload: DesktopActionPayloadInput) {
  const level = typeof payload.value === 'string' ? payload.value : null
  return isComposerThinkingLevel(level) ? level : null
}

export function getSettingsNumberValue(payload: DesktopActionPayloadInput) {
  return typeof payload.value === 'number' && Number.isFinite(payload.value) ? payload.value : null
}

export function getSettingsReset(payload: DesktopActionPayloadInput) {
  return payload.reset === true
}

export function getSettingsModelSelection(
  payload: DesktopActionPayloadInput,
): ModelSelection | null {
  const provider = typeof payload.provider === 'string' ? payload.provider : null
  const id = typeof payload.modelId === 'string' ? payload.modelId : null

  return provider && id ? { provider, id } : null
}

export function getSettingsFavoriteFolders(payload: DesktopActionPayloadInput): string[] {
  return Array.isArray(payload.folders)
    ? [
        ...new Set(
          payload.folders.flatMap((folder: unknown) => {
            if (typeof folder !== 'string') return []
            const trimmed = folder.trim()
            return trimmed ? [trimmed] : []
          }),
        ),
      ]
    : []
}

export function getSettingsProjectImportState(payload: DesktopActionPayloadInput) {
  return payload.imported === null || typeof payload.imported === 'boolean'
    ? payload.imported
    : null
}

export function getSettingsPreferredProjectLocation(payload: DesktopActionPayloadInput) {
  return typeof payload.value === 'string' ? payload.value.trim() : null
}

export function getSettingsBooleanValue(payload: DesktopActionPayloadInput) {
  return typeof payload.value === 'boolean' ? payload.value : null
}

export function getSettingsComposerStreamingBehavior(
  payload: DesktopActionPayloadInput,
): ComposerStreamingBehavior | null {
  return payload.value === 'steer' || payload.value === 'followUp' || payload.value === 'stop'
    ? payload.value
    : null
}

export function getSettingsDictationModelId(
  payload: DesktopActionPayloadInput,
): DictationModelId | null {
  return payload.value === 'tiny.en' || payload.value === 'base.en' || payload.value === 'small.en'
    ? payload.value
    : null
}

export function getSettingsProjectDeletionMode(
  payload: DesktopActionPayloadInput,
): ProjectDeletionMode | null {
  return payload.value === 'pi-only' || payload.value === 'full-clean' ? payload.value : null
}
