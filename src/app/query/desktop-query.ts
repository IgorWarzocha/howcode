const pathSeparatorPattern = /[\\/]/

import { fallbackAppSlashCommands } from '@howcode/shared/composer-slash-commands'
import {
  browserDesktopBridgeCapabilities,
  electronDesktopBridgeCapabilities,
} from '@howcode/shared/desktop-bridge-capabilities'
import type { DesktopRequestMap } from '@howcode/shared/desktop-ipc'
import type {
  AppUpdateState,
  ArchivedThread,
  ChatSidebarState,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopClipboardFilePaths,
  DesktopClipboardSnapshot,
  InboxThread,
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffImagePreview,
  ProjectDiffImageSide,
  ProjectDiffStatsResult,
  ProjectGitState,
  ProjectUsageSummary,
  ShellState,
  Thread,
  ThreadData,
  ThreadSearchResult,
} from '../desktop/types'

export {
  compileReactArtifactQuery,
  listArtifactsQuery,
  listArtifactVersionsQuery,
  saveTextToDownloadsQuery,
  updateArtifactQuery,
} from './desktop-artifact-query'
export {
  canSearchPiPackagesQuery,
  canSearchPiSkillsQuery,
  getConfiguredPiPackagesQuery,
  getConfiguredPiSkillsQuery,
  installPiPackageQuery,
  installPiSkillQuery,
  removePiPackageQuery,
  removePiSkillQuery,
  searchPiPackagesQuery,
  searchPiSkillsQuery,
} from './desktop-extension-query'
export { desktopQueryKeys } from './desktop-query-keys'
export {
  closeDesktopTerminalQuery,
  getDesktopTerminalStatusQuery,
  listDesktopTerminalsQuery,
  openDesktopTerminalQuery,
  resizeDesktopTerminalQuery,
  statDesktopTerminalSessionFileQuery,
  subscribeDesktopTerminalQuery,
  writeDesktopTerminalQuery,
} from './desktop-terminal-query'

export function hasDesktopBridgeQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.invokeAction === 'function'
}

export function getDesktopBridgeCapabilitiesQuery() {
  if (typeof window === 'undefined') {
    return browserDesktopBridgeCapabilities
  }

  return (
    window.piDesktop?.capabilities ??
    (window.piDesktop ? electronDesktopBridgeCapabilities : browserDesktopBridgeCapabilities)
  )
}

export function canUploadComposerFilesQuery() {
  return Boolean(
    getDesktopBridgeCapabilitiesQuery().browserUploads &&
      typeof window !== 'undefined' &&
      window.piDesktop?.uploadComposerFiles,
  )
}

export async function invokeDesktopActionQuery(
  action: import('../desktop/actions').DesktopAction,
  payload: import('../desktop/types').AnyDesktopActionPayload = {},
) {
  return (await window.piDesktop?.invokeAction?.(action, payload)) ?? null
}

export async function getAppUpdateStateQuery(): Promise<AppUpdateState | null> {
  return (await window.piDesktop?.getAppUpdateState?.()) ?? null
}

export async function checkAppUpdateQuery(): Promise<AppUpdateState | null> {
  return (await window.piDesktop?.checkAppUpdate?.()) ?? null
}

export async function installAppUpdateQuery(): Promise<AppUpdateState | null> {
  return (await window.piDesktop?.installAppUpdate?.()) ?? null
}

export async function restartAppUpdateQuery(): Promise<AppUpdateState | null> {
  return (await window.piDesktop?.restartAppUpdate?.()) ?? null
}

export async function getShellStateQuery(): Promise<ShellState | null> {
  return (await window.piDesktop?.getShellState?.()) ?? null
}

export async function getProjectThreadsQuery(projectId: string, chat = false): Promise<Thread[]> {
  return (await window.piDesktop?.getProjectThreads?.(projectId, { chat })) ?? []
}

export async function getChatSidebarStateQuery(
  selectedGroupId?: string | null | undefined,
): Promise<ChatSidebarState | null> {
  return (await window.piDesktop?.getChatSidebarState?.(selectedGroupId ?? null)) ?? null
}

export async function createChatGroupQuery(name: string): Promise<ChatSidebarState | null> {
  return (await window.piDesktop?.createChatGroup?.(name)) ?? null
}

export async function getInboxThreadsQuery(): Promise<InboxThread[]> {
  return (await window.piDesktop?.getInboxThreads?.()) ?? []
}

export async function getArchivedThreadsQuery(): Promise<ArchivedThread[]> {
  return (await window.piDesktop?.getArchivedThreads?.()) ?? []
}

export async function getComposerStateQuery(
  request: ComposerStateRequest = {},
): Promise<ComposerState | null> {
  return (await window.piDesktop?.getComposerState?.(request)) ?? null
}

export async function getComposerSlashCommandsQuery(
  request: ComposerStateRequest = {},
): Promise<ComposerSlashCommand[]> {
  return (await window.piDesktop?.getComposerSlashCommands?.(request)) ?? fallbackAppSlashCommands
}

export async function getComposerSkillsQuery(request: ComposerStateRequest = {}) {
  return (await window.piDesktop?.getComposerSkills?.(request)) ?? []
}

export async function getProjectGitStateQuery(projectId: string): Promise<ProjectGitState | null> {
  return (await window.piDesktop?.getProjectGitState?.(projectId)) ?? null
}

export async function getProjectUsageSummaryQuery(
  projectId: string,
): Promise<ProjectUsageSummary | null> {
  return (await window.piDesktop?.getProjectUsageSummary?.(projectId)) ?? null
}

export async function getProjectFaviconQuery(projectId: string): Promise<string | null> {
  return (await window.piDesktop?.getProjectFavicon?.(projectId)) ?? null
}

export async function startProjectDiffStreamQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
  streamId: string | null = null,
  includeUntracked = false,
) {
  return (
    (await window.piDesktop?.startProjectDiffStream?.(
      projectId,
      baseline,
      streamId,
      includeUntracked,
    )) ?? null
  )
}

export function canStartProjectDiffStreamQuery() {
  return (
    typeof window !== 'undefined' && typeof window.piDesktop?.startProjectDiffStream === 'function'
  )
}

export async function cancelProjectDiffStreamQuery(streamId: string): Promise<void> {
  await window.piDesktop?.cancelProjectDiffStream?.(streamId)
}

export async function getProjectDiffStatsQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
  includeUntracked = false,
): Promise<ProjectDiffStatsResult | null> {
  return (
    (await window.piDesktop?.getProjectDiffStats?.(projectId, baseline, includeUntracked)) ?? null
  )
}

export async function getProjectDiffImagePreviewQuery(request: {
  projectId: string
  baseline?: ProjectDiffBaseline | null | undefined
  path: string
  side: ProjectDiffImageSide
}): Promise<ProjectDiffImagePreview> {
  return (await window.piDesktop?.getProjectDiffImagePreview?.(request)) ?? null
}

export async function listProjectCommitsQuery(
  projectId: string,
  limit = 50,
): Promise<ProjectCommitEntry[]> {
  return (await window.piDesktop?.listProjectCommits?.(projectId, limit)) ?? []
}

export async function pickComposerAttachmentsQuery(
  projectId?: string | null | undefined,
): Promise<ComposerAttachment[]> {
  return (await window.piDesktop?.pickComposerAttachments?.(projectId ?? null)) ?? []
}

export async function listProjectDirectoryEntriesQuery(
  request: DesktopRequestMap['listProjectDirectoryEntries']['params'] = {},
): Promise<DesktopRequestMap['listProjectDirectoryEntries']['response'] | null> {
  return (await window.piDesktop?.listProjectDirectoryEntries?.(request)) ?? null
}

export async function listComposerAttachmentEntriesQuery(
  request: {
    projectId?: string | null | undefined
    path?: string | null | undefined
    rootPath?: string | null | undefined
  } = {},
): Promise<ComposerFilePickerState | null> {
  return (await window.piDesktop?.listComposerAttachmentEntries?.(request)) ?? null
}

export async function searchComposerAttachmentEntriesQuery(
  request: {
    projectId?: string | null | undefined
    query?: string | null | undefined
    limit?: number | null | undefined
  } = {},
) {
  return (await window.piDesktop?.searchComposerAttachmentEntries?.(request)) ?? []
}

export async function readClipboardSnapshotQuery(
  formats?: string[] | null | undefined,
): Promise<DesktopClipboardSnapshot | null> {
  return (await window.piDesktop?.readClipboardSnapshot?.(formats ?? null)) ?? null
}

export async function readClipboardFilePathsQuery(): Promise<DesktopClipboardFilePaths | null> {
  return (await window.piDesktop?.readClipboardFilePaths?.()) ?? null
}

export async function readClipboardImageQuery(): Promise<ComposerAttachment | null> {
  const image = await window.piDesktop?.readClipboardImage?.()
  if (!image) {
    return null
  }

  return {
    path: image.path,
    name: image.path.split(pathSeparatorPattern).pop() ?? image.path,
    kind: 'image',
  }
}

export async function getAttachmentKindsForPathsQuery(paths: string[]) {
  return (await window.piDesktop?.getAttachmentKindsForPaths?.(paths)) ?? null
}

export function getPathForFileQuery(file: File) {
  return window.piDesktop?.getPathForFile?.(file) ?? null
}

export async function uploadComposerFilesQuery(files: File[]): Promise<ComposerAttachment[]> {
  if (!canUploadComposerFilesQuery()) {
    return []
  }

  return (await window.piDesktop?.uploadComposerFiles?.(files)) ?? []
}

export async function openExternalQuery(url: string) {
  return (await window.piDesktop?.openExternal?.(url)) ?? false
}

export async function openPathQuery(path: string) {
  return (await window.piDesktop?.openPath?.(path)) ?? false
}

export async function getThreadQuery(
  sessionPath: string,
  historyCompactions = 0,
): Promise<ThreadData | null> {
  return (await window.piDesktop?.getThread?.(sessionPath, historyCompactions)) ?? null
}

export async function getSessionTreeListQuery(sessionPath: string) {
  return (await window.piDesktop?.getSessionTreeList?.(sessionPath)) ?? null
}

export async function getThreadPreviewAtEntryQuery(
  sessionPath: string,
  targetEntryId: string,
  historyCompactions = 0,
): Promise<ThreadData | null> {
  return (
    (await window.piDesktop?.getThreadPreviewAtEntry?.(
      sessionPath,
      targetEntryId,
      historyCompactions,
    )) ?? null
  )
}

export async function searchThreadQuery(
  sessionPath: string,
  query: string,
): Promise<ThreadSearchResult> {
  return (
    (await window.piDesktop?.searchThread?.(sessionPath, query)) ?? {
      matches: [],
      searchedMessageCount: 0,
    }
  )
}

export async function getDictationStateQuery() {
  return (await window.piDesktop?.getDictationState?.().catch(() => null)) ?? null
}

export async function listDictationModelsQuery() {
  return (await window.piDesktop?.listDictationModels?.().catch(() => [])) ?? []
}

export async function installDictationModelQuery(
  modelId: import('../desktop/types').DictationModelId,
) {
  return (await window.piDesktop?.installDictationModel?.(modelId)) ?? null
}

export async function removeDictationModelQuery(
  modelId: import('../desktop/types').DictationModelId,
) {
  return (await window.piDesktop?.removeDictationModel?.(modelId)) ?? null
}

export async function transcribeDictationQuery(
  request: import('../desktop/types').DictationTranscriptionRequest,
) {
  return (await window.piDesktop?.transcribeDictation?.(request)) ?? null
}

export function canTranscribeDictationQuery() {
  return (
    typeof window !== 'undefined' && typeof window.piDesktop?.transcribeDictation === 'function'
  )
}

export function subscribeDesktopEvents(
  listener: (event: import('../desktop/types').DesktopEvent) => void,
) {
  return window.piDesktop?.subscribe?.(listener) ?? (() => undefined)
}

export async function watchSessionQuery(sessionPath: string | null): Promise<void> {
  await window.piDesktop?.watchSession?.(sessionPath)
}
