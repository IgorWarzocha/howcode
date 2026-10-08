import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { CodingService } from '../../../shared/desktop-service-contracts'

type CodingRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listDirectoryDirectoryEntries'
  | 'getDirectoryGitState'
  | 'getDirectoryUsageSummary'
  | 'getDirectoryFavicon'
  | 'startDirectoryDiffStream'
  | 'cancelDirectoryDiffStream'
  | 'getDirectoryDiffStats'
  | 'getDirectoryDiffImagePreview'
  | 'getDirectoryDiffFileContents'
  | 'captureDirectoryDiffBaseline'
  | 'listDirectoryCommits'
>

export function createCodingHandlers(
  coding: CodingService,
  listDirectoryDirectoryEntries: DesktopRequestHandlerMap['listDirectoryDirectoryEntries'],
): CodingRequestHandlers {
  return {
    listDirectoryDirectoryEntries,
    getDirectoryGitState: ({ directoryId }) => coding.loadDirectoryGitState(directoryId),
    getDirectoryUsageSummary: ({ directoryId }) => coding.loadDirectoryUsageSummary(directoryId),
    getDirectoryFavicon: ({ directoryId }) => coding.loadDirectoryFavicon(directoryId),
    startDirectoryDiffStream: ({ directoryId, baseline, streamId, includeUntracked }) =>
      coding.startDirectoryDiffStream(
        directoryId,
        baseline ?? null,
        streamId ?? null,
        includeUntracked ?? false,
      ),
    cancelDirectoryDiffStream: async ({ streamId }) => {
      await coding.cancelDirectoryDiffStream(streamId)
      return undefined
    },
    getDirectoryDiffStats: ({ directoryId, baseline, includeUntracked }) =>
      coding.loadDirectoryDiffStats(directoryId, baseline ?? null, includeUntracked ?? false),
    getDirectoryDiffImagePreview: (request) => coding.loadDirectoryDiffImagePreview(request),
    getDirectoryDiffFileContents: (request) => coding.loadDirectoryDiffFileContents(request),
    captureDirectoryDiffBaseline: ({ directoryId }) =>
      coding.captureDirectoryDiffBaseline(directoryId),
    listDirectoryCommits: ({ directoryId, limit }) =>
      coding.listDirectoryCommits(directoryId, limit ?? null),
  }
}
