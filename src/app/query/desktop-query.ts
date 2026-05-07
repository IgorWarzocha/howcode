const pathSeparatorPattern = /[\\/]/

import { fallbackAppSlashCommands } from '../../../shared/composer-slash-commands'
import { getPersistedSessionPath } from '../../../shared/session-paths'
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
  ShellState,
  SkillCreatorSessionState,
  Thread,
  ThreadData,
} from '../desktop/types'

export const desktopQueryKeys = {
  appUpdateState: () => ['desktop', 'appUpdateState'] as const,
  shellState: () => ['desktop', 'shellState'] as const,
  piPackageCatalog: (query: string) => ['desktop', 'piPackages', 'catalog', query] as const,
  configuredPiPackages: (projectPath?: string | null | undefined, chat = false) =>
    ['desktop', 'piPackages', 'configured', projectPath ?? null, chat] as const,
  piSkillCatalog: (query: string) => ['desktop', 'piSkills', 'catalog', query] as const,
  configuredPiSkills: (projectPath?: string | null | undefined, chat = false) =>
    ['desktop', 'piSkills', 'configured', projectPath ?? null, chat] as const,
  projectThreads: (projectId: string, chat = false) =>
    ['desktop', 'projectThreads', projectId, chat] as const,
  chatSidebarState: (selectedGroupId?: string | null) =>
    ['desktop', 'chatSidebarState', selectedGroupId ?? null] as const,
  inboxThreads: () => ['desktop', 'inboxThreads'] as const,
  archivedThreads: () => ['desktop', 'archivedThreads'] as const,
  composerState: (request: ComposerStateRequest) =>
    [
      'desktop',
      'composerState',
      request.projectId ?? null,
      getPersistedSessionPath(request.sessionPath),
      request.composerMode ?? null,
      request.chatGroupId ?? null,
    ] as const,
  projectGitState: (projectId: string) => ['desktop', 'projectGitState', projectId] as const,
  projectDiffPrefix: (projectId: string) => ['desktop', 'projectDiff', projectId] as const,
  projectDiff: (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    ['desktop', 'projectDiff', projectId, baseline?.kind ?? 'head', baseline ?? null] as const,
  projectDiffStatsPrefix: (projectId: string) =>
    ['desktop', 'projectDiffStats', projectId] as const,
  projectDiffStats: (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    ['desktop', 'projectDiffStats', projectId, baseline?.kind ?? 'head', baseline ?? null] as const,
  projectCommitsPrefix: (projectId: string) => ['desktop', 'projectCommits', projectId] as const,
  projectCommits: (projectId: string, limit = 50) =>
    ['desktop', 'projectCommits', projectId, limit] as const,
  threadPrefix: (sessionPath: string) => ['desktop', 'thread', sessionPath] as const,
  thread: (sessionPath: string, refreshKey = 0, historyCompactions = 0) =>
    ['desktop', 'thread', sessionPath, refreshKey, historyCompactions] as const,
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

export async function listArtifactsQuery(conversationId?: string | null) {
  return (await window.piDesktop?.listArtifacts?.(conversationId ?? null)) ?? []
}

export async function getArtifactQuery(artifactSlug: string, conversationId?: string | null) {
  return (await window.piDesktop?.getArtifact?.(artifactSlug, conversationId ?? null)) ?? null
}

export async function updateArtifactQuery(
  artifactSlug: string,
  content: string,
  conversationId?: string | null | undefined,
) {
  return (
    (await window.piDesktop?.updateArtifact?.(artifactSlug, content, conversationId ?? null)) ??
    null
  )
}

export async function editArtifactQuery(
  artifactSlug: string,
  edits: Array<{ oldText: string; newText: string }>,
  conversationId?: string | null | undefined,
) {
  return (
    (await window.piDesktop?.editArtifact?.(artifactSlug, edits, conversationId ?? null)) ?? null
  )
}

export async function listArtifactVersionsQuery(artifactSlug: string) {
  return (await window.piDesktop?.listArtifactVersions?.(artifactSlug)) ?? []
}

export async function compileReactArtifactQuery(source: string) {
  return (
    (await window.piDesktop?.compileReactArtifact?.(source)) ?? {
      ok: false as const,
      error: 'Artifact compiler is unavailable.',
      warnings: [],
    }
  )
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

export async function getProjectDiffQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
): Promise<ProjectDiffResult | null> {
  return (await window.piDesktop?.getProjectDiff?.(projectId, baseline)) ?? null
}

export async function getProjectDiffStatsQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
): Promise<ProjectDiffStatsResult | null> {
  return (await window.piDesktop?.getProjectDiffStats?.(projectId, baseline)) ?? null
}

export async function captureProjectDiffBaselineQuery(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline | null> {
  return (await window.piDesktop?.captureProjectDiffBaseline?.(projectId)) ?? null
}

export async function listProjectCommitsQuery(
  projectId: string,
  limit = 50,
): Promise<ProjectCommitEntry[]> {
  return (await window.piDesktop?.listProjectCommits?.(projectId, limit)) ?? []
}

export async function searchPiPackagesQuery(
  request: {
    query?: string | null | undefined
    cursor?: number | null | undefined
    pageSize?: number | null | undefined
  } = {},
): Promise<PiPackageCatalogPage> {
  return (
    (await window.piDesktop?.searchPiPackages?.(request)) ?? {
      query: request.query?.trim() ?? '',
      sort: 'monthlyDownloads-desc',
      total: 0,
      nextCursor: null,
      items: [],
    }
  )
}

export async function searchPiSkillsQuery(
  request: { query?: string | null | undefined; limit?: number | null | undefined } = {},
): Promise<PiSkillCatalogPage> {
  return (
    (await window.piDesktop?.searchPiSkills?.(request)) ?? {
      query: request.query?.trim() ?? '',
      total: 0,
      items: [],
    }
  )
}

export async function getConfiguredPiPackagesQuery(
  request: { projectPath?: string | null | undefined; chat?: boolean | undefined } = {},
): Promise<PiConfiguredPackage[]> {
  return (await window.piDesktop?.getConfiguredPiPackages?.(request)) ?? []
}

export async function installPiPackageQuery(request: {
  source: string
  kind?: 'npm' | 'git' | undefined
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.installPiPackage?.(request)) ?? null
}

export async function removePiPackageQuery(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.removePiPackage?.(request)) ?? null
}

export async function getConfiguredPiSkillsQuery(
  request: { projectPath?: string | null | undefined; chat?: boolean | undefined } = {},
): Promise<PiConfiguredSkill[]> {
  return (await window.piDesktop?.getConfiguredPiSkills?.(request)) ?? []
}

export async function installPiSkillQuery(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.installPiSkill?.(request)) ?? null
}

export async function removePiSkillQuery(request: {
  installedPath: string
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.removePiSkill?.(request)) ?? null
}

export async function startSkillCreatorSessionQuery(request: {
  prompt: string
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<SkillCreatorSessionState | null> {
  return (await window.piDesktop?.startSkillCreatorSession?.(request)) ?? null
}

export async function continueSkillCreatorSessionQuery(request: {
  sessionId: string
  prompt: string
}): Promise<SkillCreatorSessionState | null> {
  return (await window.piDesktop?.continueSkillCreatorSession?.(request)) ?? null
}

export async function closeSkillCreatorSessionQuery(sessionId: string): Promise<void> {
  await window.piDesktop?.closeSkillCreatorSession?.(sessionId)
}

export async function pickComposerAttachmentsQuery(
  projectId?: string | null | undefined,
): Promise<ComposerAttachment[]> {
  return (await window.piDesktop?.pickComposerAttachments?.(projectId ?? null)) ?? []
}

export async function clearClipboardImagesQuery() {
  return (await window.piDesktop?.clearClipboardImages?.()) ?? { clearedCount: 0 }
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
