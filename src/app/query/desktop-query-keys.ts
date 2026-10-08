import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ComposerStateRequest, DirectoryDiffBaseline } from '../desktop/types'

export const desktopQueryKeys = {
  shellState: () => ['desktop', 'shellState'] as const,
  piSkillCatalog: (query: string, limit?: number | undefined) =>
    ['desktop', 'piSkills', 'catalog', query, limit ?? null] as const,
  configuredPiSkills: (directoryPath?: string | null | undefined, chat = false) =>
    ['desktop', 'piSkills', 'configured', directoryPath ?? null, chat] as const,
  directoryChats: (directoryId: string) => ['desktop', 'directoryChats', directoryId] as const,
  workspaceNavigationState: (selectedWorkspaceId?: string | null) =>
    ['desktop', 'workspaceNavigationState', selectedWorkspaceId ?? null] as const,
  inboxChats: () => ['desktop', 'inboxChats'] as const,
  archivedChats: () => ['desktop', 'archivedChats'] as const,
  composerState: (request: ComposerStateRequest) =>
    [
      'desktop',
      'composerState',
      request.directoryId ?? null,
      getPersistedConversationId(request.conversationId),
      request.composerProfile ?? null,
      request.workspaceId ?? null,
    ] as const,
  directoryGitState: (directoryId: string) =>
    ['desktop', 'directoryGitState', directoryId] as const,
  directoryUsageSummary: (directoryId: string) =>
    ['desktop', 'directoryUsageSummary', directoryId] as const,
  directoryDiffStatsPrefix: (directoryId: string) =>
    ['desktop', 'directoryDiffStats', directoryId] as const,
  directoryDiffStats: (
    directoryId: string,
    baseline: DirectoryDiffBaseline | null = null,
    includeUntracked = false,
  ) =>
    [
      'desktop',
      'directoryDiffStats',
      directoryId,
      baseline?.kind ?? 'head',
      baseline ?? null,
      includeUntracked,
    ] as const,
  directoryDiffImagePreview: (
    directoryId: string,
    path: string,
    side: 'old' | 'new',
    baseline: DirectoryDiffBaseline | null = null,
  ) =>
    [
      'desktop',
      'directoryDiffImagePreview',
      directoryId,
      path,
      side,
      baseline?.kind ?? 'head',
      baseline ?? null,
    ] as const,
  directoryDiffImagePreviewPrefix: (directoryId: string) =>
    ['desktop', 'directoryDiffImagePreview', directoryId] as const,
  directoryCommitsPrefix: (directoryId: string) =>
    ['desktop', 'directoryCommits', directoryId] as const,
  directoryCommits: (directoryId: string, limit = 50) =>
    ['desktop', 'directoryCommits', directoryId, limit] as const,
  chatPrefix: (conversationId: string) => ['desktop', 'chat', conversationId] as const,
  chat: (conversationId: string, refreshKey = 0, historyCompactions = 0) =>
    ['desktop', 'chat', conversationId, refreshKey, historyCompactions] as const,
  conversationEntries: (conversationId: string) =>
    ['desktop', 'conversationEntries', conversationId] as const,
  chatPreviewAtEntry: (conversationId: string, targetEntryId: string, historyCompactions = 0) =>
    ['desktop', 'chatPreviewAtEntry', conversationId, targetEntryId, historyCompactions] as const,
}
