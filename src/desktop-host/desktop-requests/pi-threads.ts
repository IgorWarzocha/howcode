import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory'

type PiThreadsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getShellState'
  | 'getComposerState'
  | 'getComposerSkills'
  | 'getComposerSlashCommands'
  | 'getProjectThreads'
  | 'getChatSidebarState'
  | 'createChatGroup'
  | 'getInboxThreads'
  | 'getArchivedThreads'
  | 'getThread'
  | 'getConversationEntries'
  | 'getThreadPreviewAtEntry'
  | 'searchThread'
  | 'watchConversation'
  | 'invokeAction'
>

export function createPiThreadsHandlers(
  piThreads: PiThreadsService,
  onSettingsChanged?: (() => Promise<void> | void) | undefined,
): PiThreadsRequestHandlers {
  return {
    getShellState: async () => piThreads.loadShellState(getDesktopWorkingDirectory()),
    getComposerState: (request) => piThreads.loadComposerState(request),
    getComposerSkills: (request) => piThreads.loadComposerSkills(request),
    getComposerSlashCommands: (request) => piThreads.loadComposerSlashCommands(request),
    getProjectThreads: (request) =>
      piThreads.loadProjectThreads(
        request?.projectId ?? '',
        request?.chat === undefined ? {} : { chat: request.chat },
      ),
    getChatSidebarState: (request) =>
      piThreads.loadChatSidebarState(request?.selectedGroupId ?? null),
    createChatGroup: ({ name }) => piThreads.createChatGroup(name),
    getInboxThreads: () => piThreads.loadInboxThreadList(),
    getArchivedThreads: () => piThreads.loadArchivedThreadList(),
    getThread: ({ conversationId, historyCompactions = 0 }) =>
      piThreads.loadThread(conversationId, { historyCompactions }),
    getConversationEntries: ({ conversationId }) =>
      piThreads.loadConversationEntries(conversationId),
    getThreadPreviewAtEntry: ({ conversationId, targetEntryId, historyCompactions = 0 }) =>
      piThreads.loadThreadPreviewAtEntry(conversationId, targetEntryId, { historyCompactions }),
    searchThread: ({ conversationId, query }) => piThreads.searchThread(conversationId, query),
    watchConversation: async ({ conversationId }) => {
      await piThreads.watchConversation(conversationId)
      return { ok: true }
    },
    invokeAction: async ({ action, payload = {} }) => {
      try {
        const result = await piThreads.handleDesktopAction(action, payload)
        if (action === 'settings.update') await onSettingsChanged?.()
        if (
          action === 'settings.update' &&
          payload &&
          typeof payload === 'object' &&
          'key' in payload &&
          payload.key === 'customPiDirectory' &&
          result?.didMutate
        ) {
          await piThreads.disposeDesktopRuntime?.()
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
