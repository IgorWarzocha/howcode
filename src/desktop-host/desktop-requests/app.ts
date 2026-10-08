import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { AppService } from '../../../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory'

type AppRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getShellState'
  | 'getComposerState'
  | 'getComposerSkills'
  | 'getComposerSlashCommands'
  | 'getDirectoryChats'
  | 'getWorkspaceNavigationState'
  | 'createWorkspace'
  | 'getInboxChats'
  | 'getArchivedChats'
  | 'getChat'
  | 'getConversationEntries'
  | 'getChatPreviewAtEntry'
  | 'searchChat'
  | 'watchConversation'
  | 'invokeAction'
>

export function createAppHandlers(
  app: AppService,
  onSettingsChanged?: (() => Promise<void> | void) | undefined,
): AppRequestHandlers {
  return {
    getShellState: async () => app.loadShellState(getDesktopWorkingDirectory()),
    getComposerState: (request) => app.loadComposerState(request),
    getComposerSkills: (request) => app.loadComposerSkills(request),
    getComposerSlashCommands: (request) => app.loadComposerSlashCommands(request),
    getDirectoryChats: (request) => app.loadDirectoryChats(request?.directoryId ?? ''),
    getWorkspaceNavigationState: (request) =>
      app.loadWorkspaceNavigationState(request?.selectedWorkspaceId ?? null),
    createWorkspace: ({ name }) => app.createWorkspace(name),
    getInboxChats: () => app.loadInboxChatList(),
    getArchivedChats: () => app.loadArchivedChatList(),
    getChat: ({ conversationId, historyCompactions = 0 }) =>
      app.loadChat(conversationId, { historyCompactions }),
    getConversationEntries: ({ conversationId }) => app.loadConversationEntries(conversationId),
    getChatPreviewAtEntry: ({ conversationId, targetEntryId, historyCompactions = 0 }) =>
      app.loadChatPreviewAtEntry(conversationId, targetEntryId, { historyCompactions }),
    searchChat: ({ conversationId, query }) => app.searchChat(conversationId, query),
    watchConversation: async ({ conversationId }) => {
      await app.watchConversation(conversationId)
      return { ok: true }
    },
    invokeAction: async ({ action, payload = {} }) => {
      try {
        const result = await app.handleDesktopAction(action, payload)
        if (action === 'settings.update') await onSettingsChanged?.()
        if (
          action === 'settings.update' &&
          payload &&
          typeof payload === 'object' &&
          'key' in payload &&
          payload.key === 'customPiDirectory' &&
          result?.didMutate
        ) {
          await app.disposeDesktopRuntime?.()
        }
        return {
          ok: true,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: result ?? null,
        }
      } catch (error) {
        console.error('invokeAction failed', { action, payload, error })
        return {
          ok: false,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: {
            error: error instanceof Error ? error.message : 'Desktop action failed unexpectedly.',
          },
        }
      }
    },
  }
}
