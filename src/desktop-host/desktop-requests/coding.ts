import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../shared/desktop-service-contracts'

type CodingRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listProjectDirectoryEntries'
  | 'getProjectGitState'
  | 'getProjectUsageSummary'
  | 'getProjectFavicon'
  | 'startProjectDiffStream'
  | 'cancelProjectDiffStream'
  | 'getProjectDiffStats'
  | 'getProjectDiffImagePreview'
  | 'getProjectDiffFileContents'
  | 'captureProjectDiffBaseline'
  | 'listProjectCommits'
>

export function createCodingHandlers(
  piThreads: PiThreadsService,
  listProjectDirectoryEntries: DesktopRequestHandlerMap['listProjectDirectoryEntries'],
): CodingRequestHandlers {
  return {
    listProjectDirectoryEntries,
    getProjectGitState: ({ projectId }) => piThreads.loadProjectGitState(projectId),
    getProjectUsageSummary: ({ projectId }) => piThreads.loadProjectUsageSummary(projectId),
    getProjectFavicon: ({ projectId }) => piThreads.loadProjectFavicon(projectId),
    startProjectDiffStream: ({ projectId, baseline, streamId, includeUntracked }) =>
      piThreads.startProjectDiffStream(
        projectId,
        baseline ?? null,
        streamId ?? null,
        includeUntracked ?? false,
      ),
    cancelProjectDiffStream: async ({ streamId }) => {
      await piThreads.cancelProjectDiffStream(streamId)
      return undefined
    },
    getProjectDiffStats: ({ projectId, baseline, includeUntracked }) =>
      piThreads.loadProjectDiffStats(projectId, baseline ?? null, includeUntracked ?? false),
    getProjectDiffImagePreview: (request) => piThreads.loadProjectDiffImagePreview(request),
    getProjectDiffFileContents: (request) => piThreads.loadProjectDiffFileContents(request),
    captureProjectDiffBaseline: ({ projectId }) => piThreads.captureProjectDiffBaseline(projectId),
    listProjectCommits: ({ projectId, limit }) =>
      piThreads.listProjectCommits(projectId, limit ?? null),
  }
}
