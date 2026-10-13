import { gitQueryKeys } from '@howaboua/howcode-sdk/git-query-keys'
import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ComposerStateRequest } from '../desktop/types'

export const desktopQueryKeys = {
  ...gitQueryKeys,
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
  directoryUsageSummary: (directoryId: string) =>
    ['desktop', 'directoryUsageSummary', directoryId] as const,
  chatPrefix: (conversationId: string) => ['desktop', 'chat', conversationId] as const,
  chat: (conversationId: string, refreshKey = 0, historyCompactions = 0) =>
    ['desktop', 'chat', conversationId, refreshKey, historyCompactions] as const,
  conversationEntries: (conversationId: string) =>
    ['desktop', 'conversationEntries', conversationId] as const,
  chatPreviewAtEntry: (conversationId: string, targetEntryId: string, historyCompactions = 0) =>
    ['desktop', 'chatPreviewAtEntry', conversationId, targetEntryId, historyCompactions] as const,
}
