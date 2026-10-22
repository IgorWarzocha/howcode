import { isDirectoryDiffBaseline } from '@howaboua/howcode-git/action-payloads'
import * as Schema from 'effect/Schema'
import { isComposerThinkingLevel } from './composer-thinking-level'
import { getLocalDraftBranchName, getPersistedConversationId } from './conversation-ids'
import { ComposerExtensionSelectionSchema } from './desktop-composer-schema'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  DesktopActionPayloadInput,
  DirectoryDeletionMode,
  DirectoryDiffDefaultBaseline,
  DirectoryDiffRenderMode,
  ModelSelection,
} from './desktop-contracts'
import { EnabledToolkitComponentsSchema } from './toolkit-components'

export function getComposerRequest(payload: DesktopActionPayloadInput): ComposerStateRequest {
  return {
    ...(payload.composerExtensions === undefined
      ? {}
      : {
          composerExtensions: Schema.decodeUnknownSync(ComposerExtensionSelectionSchema)(
            payload.composerExtensions,
          ),
        }),
    directoryId: typeof payload.directoryId === 'string' ? payload.directoryId : null,
    conversationId: getPersistedConversationId(
      typeof payload.conversationId === 'string' ? payload.conversationId : null,
    ),
    workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : null,
    branchName:
      typeof payload.branchName === 'string'
        ? payload.branchName
        : getLocalDraftBranchName(
            typeof payload.conversationId === 'string' ? payload.conversationId : null,
          ),
  }
}

export function getDirectoryId(payload: DesktopActionPayloadInput) {
  return typeof payload.directoryId === 'string' ? payload.directoryId : null
}

export function getRootDirectoryId(payload: DesktopActionPayloadInput) {
  return typeof payload.rootDirectoryId === 'string' ? payload.rootDirectoryId : null
}

export function getConversationId(payload: DesktopActionPayloadInput) {
  return typeof payload.conversationId === 'string' ? payload.conversationId : null
}

export function getChatId(payload: DesktopActionPayloadInput) {
  return typeof payload.chatId === 'string' ? payload.chatId : null
}

export function getChatIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.chatIds)
    ? payload.chatIds.filter((chatId: unknown): chatId is string => typeof chatId === 'string')
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

export function getDirectoryName(payload: DesktopActionPayloadInput) {
  const directoryName =
    typeof payload.directoryName === 'string' ? payload.directoryName.trim() : ''
  return directoryName.length > 0 ? directoryName : null
}

export function getDirectoryIds(payload: DesktopActionPayloadInput) {
  return Array.isArray(payload.directoryIds)
    ? payload.directoryIds.filter(
        (directoryId: unknown): directoryId is string => typeof directoryId === 'string',
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

export function getSettingsDirectoryDiffBaselineDefault(
  payload: DesktopActionPayloadInput,
): DirectoryDiffDefaultBaseline | null {
  return isDirectoryDiffBaseline(payload.value) &&
    (payload.value.kind === 'head' ||
      payload.value.kind === 'previous' ||
      payload.value.kind === 'main-branch' ||
      payload.value.kind === 'dev-branch')
    ? payload.value
    : null
}

export function getSettingsDirectoryDiffRenderModeDefault(
  payload: DesktopActionPayloadInput,
): DirectoryDiffRenderMode | null {
  return payload.value === 'stacked' || payload.value === 'split' ? payload.value : null
}

export function getSettingsKey(payload: DesktopActionPayloadInput) {
  return payload.key === 'enabledToolkitComponents' ||
    payload.key === 'defaultModel' ||
    payload.key === 'defaultThinkingLevel' ||
    payload.key === 'gitCommitMessageModel' ||
    payload.key === 'gitCommitMessageThinkingLevel' ||
    payload.key === 'composerStreamingBehavior' ||
    payload.key === 'favoriteFolders' ||
    payload.key === 'projectImportState' ||
    payload.key === 'preferredDirectoryLocation' ||
    payload.key === 'customPiDirectory' ||
    payload.key === 'initializeGitOnDirectoryCreate' ||
    payload.key === 'projectDashboardEnabled' ||
    payload.key === 'gitOpsDefaultMode' ||
    payload.key === 'gitDiffBaselineDefault' ||
    payload.key === 'gitDiffRenderModeDefault' ||
    payload.key === 'gitDiffFileTreeDefaultVisible' ||
    payload.key === 'gitDiffIncludeUntrackedDefault' ||
    payload.key === 'directoryDeletionMode' ||
    payload.key === 'hideSidebarSessionCounts' ||
    payload.key === 'navigationRenderer' ||
    payload.key === 'dictationProvider' ||
    payload.key === 'hoverToFocus' ||
    payload.key === 'hoverToBlur' ||
    payload.key === 'keybindings' ||
    payload.key === 'composerSendMode'
    ? (payload.key as keyof AppSettings)
    : null
}

export function getConversationFork(payload: DesktopActionPayloadInput) {
  const targetEntryId =
    typeof payload.targetEntryId === 'string' ? payload.targetEntryId.trim() : ''
  return targetEntryId ? { targetEntryId } : null
}

export function getSettingsThinkingLevel(payload: DesktopActionPayloadInput) {
  const level = typeof payload.value === 'string' ? payload.value : null
  return isComposerThinkingLevel(level) ? level : null
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

export function getSettingsDirectoryImportState(payload: DesktopActionPayloadInput) {
  return payload.imported === null || typeof payload.imported === 'boolean'
    ? payload.imported
    : null
}

export function getSettingsPreferredDirectoryLocation(payload: DesktopActionPayloadInput) {
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

export function getSettingsDirectoryDeletionMode(
  payload: DesktopActionPayloadInput,
): DirectoryDeletionMode | null {
  return payload.value === 'pi-only' || payload.value === 'full-clean' ? payload.value : null
}

export function getSettingsToolkitComponents(payload: DesktopActionPayloadInput) {
  return Schema.decodeUnknownSync(EnabledToolkitComponentsSchema)(payload.value)
}
