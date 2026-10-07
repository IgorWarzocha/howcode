import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { CodingService } from '../../../shared/desktop-service-contracts'

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
  coding: CodingService,
  listProjectDirectoryEntries: DesktopRequestHandlerMap['listProjectDirectoryEntries'],
): CodingRequestHandlers {
  return {
    listProjectDirectoryEntries,
    getProjectGitState: ({ projectId }) => coding.loadProjectGitState(projectId),
    getProjectUsageSummary: ({ projectId }) => coding.loadProjectUsageSummary(projectId),
    getProjectFavicon: ({ projectId }) => coding.loadProjectFavicon(projectId),
    startProjectDiffStream: ({ projectId, baseline, streamId, includeUntracked }) =>
      coding.startProjectDiffStream(
        projectId,
        baseline ?? null,
        streamId ?? null,
        includeUntracked ?? false,
      ),
    cancelProjectDiffStream: async ({ streamId }) => {
      await coding.cancelProjectDiffStream(streamId)
      return undefined
    },
    getProjectDiffStats: ({ projectId, baseline, includeUntracked }) =>
      coding.loadProjectDiffStats(projectId, baseline ?? null, includeUntracked ?? false),
    getProjectDiffImagePreview: (request) => coding.loadProjectDiffImagePreview(request),
    getProjectDiffFileContents: (request) => coding.loadProjectDiffFileContents(request),
    captureProjectDiffBaseline: ({ projectId }) => coding.captureProjectDiffBaseline(projectId),
    listProjectCommits: ({ projectId, limit }) =>
      coding.listProjectCommits(projectId, limit ?? null),
  }
}
