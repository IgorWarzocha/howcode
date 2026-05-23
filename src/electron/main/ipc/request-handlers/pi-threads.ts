import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../../../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../../../../../shared/desktop-working-directory'

type PiThreadsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getShellState'
  | 'getProjectGitState'
  | 'getProjectUsageSummary'
  | 'getProjectDiff'
  | 'startProjectDiffStream'
  | 'getProjectDiffStats'
  | 'getProjectDiffImagePreview'
  | 'captureProjectDiffBaseline'
  | 'listProjectCommits'
  | 'getComposerState'
  | 'getComposerSlashCommands'
  | 'getComposerSkills'
  | 'getDictationState'
  | 'listDictationModels'
  | 'installDictationModel'
  | 'removeDictationModel'
  | 'transcribeDictation'
  | 'getProjectThreads'
  | 'getChatSidebarState'
  | 'createChatGroup'
  | 'listArtifacts'
  | 'getArtifact'
  | 'updateArtifact'
  | 'editArtifact'
  | 'listArtifactVersions'
  | 'compileReactArtifact'
  | 'getInboxThreads'
  | 'getArchivedThreads'
  | 'getThread'
  | 'searchThread'
  | 'watchSession'
  | 'invokeAction'
>

export function createPiThreadsHandlers(
  piThreads: PiThreadsService,
  onSettingsChanged?: (() => Promise<void> | void) | undefined,
): PiThreadsRequestHandlers {
  return {
    getShellState: async () => piThreads.loadShellState(getDesktopWorkingDirectory()),
    getProjectGitState: ({ projectId }) => piThreads.loadProjectGitState(projectId),
    getProjectUsageSummary: ({ projectId }) => piThreads.loadProjectUsageSummary(projectId),
    getProjectDiff: ({ projectId, baseline }) =>
      piThreads.loadProjectDiff(projectId, baseline ?? null),
    startProjectDiffStream: ({ projectId, baseline, streamId }) =>
      piThreads.startProjectDiffStream(projectId, baseline ?? null, streamId ?? null),
    getProjectDiffStats: ({ projectId, baseline }) =>
      piThreads.loadProjectDiffStats(projectId, baseline ?? null),
    getProjectDiffImagePreview: (request) => piThreads.loadProjectDiffImagePreview(request),
    captureProjectDiffBaseline: ({ projectId }) => piThreads.captureProjectDiffBaseline(projectId),
    listProjectCommits: ({ projectId, limit }) =>
      piThreads.listProjectCommits(projectId, limit ?? null),
    getComposerState: (request) => piThreads.loadComposerState(request),
    getComposerSlashCommands: (request) => piThreads.loadComposerSlashCommands(request),
    getComposerSkills: (request) => piThreads.loadComposerSkills(request),
    getDictationState: () => piThreads.getDictationState(),
    listDictationModels: () => piThreads.listDictationModels(),
    installDictationModel: (request) => piThreads.installDictationModel(request),
    removeDictationModel: (request) => piThreads.removeDictationModel(request),
    transcribeDictation: (request) => piThreads.transcribeDictation(request),
    getProjectThreads: (request) =>
      piThreads.loadProjectThreads(
        request?.projectId ?? '',
        request?.chat === undefined ? {} : { chat: request.chat },
      ),
    getChatSidebarState: (request) =>
      piThreads.loadChatSidebarState(request?.selectedGroupId ?? null),
    createChatGroup: ({ name }) => piThreads.createChatGroup(name),
    listArtifacts: (request) => piThreads.listArtifacts(request?.conversationId ?? null),
    getArtifact: ({ artifactSlug, conversationId }) =>
      piThreads.getArtifact(artifactSlug, conversationId ?? null),
    updateArtifact: ({ artifactSlug, content, conversationId }) =>
      piThreads.updateArtifact({
        slug: artifactSlug,
        content,
        conversationId: conversationId ?? null,
      }),
    editArtifact: ({ artifactSlug, edits, conversationId }) =>
      piThreads.editArtifact({ slug: artifactSlug, edits, conversationId: conversationId ?? null }),
    listArtifactVersions: ({ artifactSlug }) => piThreads.listArtifactVersions(artifactSlug),
    compileReactArtifact: ({ source }) => piThreads.compileReactArtifact(source),
    getInboxThreads: () => piThreads.loadInboxThreadList(),
    getArchivedThreads: () => piThreads.loadArchivedThreadList(),
    getThread: ({ sessionPath, historyCompactions = 0 }) =>
      piThreads.loadThread(sessionPath, { historyCompactions }),
    searchThread: ({ sessionPath, query }) => piThreads.searchThread(sessionPath, query),
    watchSession: async ({ sessionPath }) => {
      await piThreads.setWatchedSessionPath(sessionPath)
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
