import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import type { ComposerStateRequest, ProjectDiffBaseline } from '../desktop/types'

export const desktopQueryKeys = {
  appUpdateState: () => ['desktop', 'appUpdateState'] as const,
  shellState: () => ['desktop', 'shellState'] as const,
  piPackageCatalog: (query: string) => ['desktop', 'piPackages', 'catalog', query] as const,
  configuredPiPackages: (projectPath?: string | null | undefined, chat = false) =>
    ['desktop', 'piPackages', 'configured', projectPath ?? null, chat] as const,
  piSkillCatalog: (query: string, limit?: number | undefined) =>
    ['desktop', 'piSkills', 'catalog', query, limit ?? null] as const,
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
  projectUsageSummary: (projectId: string) =>
    ['desktop', 'projectUsageSummary', projectId] as const,
  projectDiffStatsPrefix: (projectId: string) =>
    ['desktop', 'projectDiffStats', projectId] as const,
  projectDiffStats: (
    projectId: string,
    baseline: ProjectDiffBaseline | null = null,
    includeUntracked = false,
  ) =>
    [
      'desktop',
      'projectDiffStats',
      projectId,
      baseline?.kind ?? 'head',
      baseline ?? null,
      includeUntracked,
    ] as const,
  projectDiffImagePreview: (
    projectId: string,
    path: string,
    side: 'old' | 'new',
    baseline: ProjectDiffBaseline | null = null,
  ) =>
    [
      'desktop',
      'projectDiffImagePreview',
      projectId,
      path,
      side,
      baseline?.kind ?? 'head',
      baseline ?? null,
    ] as const,
  projectDiffImagePreviewPrefix: (projectId: string) =>
    ['desktop', 'projectDiffImagePreview', projectId] as const,
  projectCommitsPrefix: (projectId: string) => ['desktop', 'projectCommits', projectId] as const,
  projectCommits: (projectId: string, limit = 50) =>
    ['desktop', 'projectCommits', projectId, limit] as const,
  threadPrefix: (sessionPath: string) => ['desktop', 'thread', sessionPath] as const,
  thread: (sessionPath: string, refreshKey = 0, historyCompactions = 0) =>
    ['desktop', 'thread', sessionPath, refreshKey, historyCompactions] as const,
  sessionTreeList: (sessionPath: string) => ['desktop', 'sessionTreeList', sessionPath] as const,
}
