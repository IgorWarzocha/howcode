import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { GitService } from '../../../shared/desktop-service-contracts'

export function createGitHandlers(git: GitService) {
  return {
    getDirectoryGitState: ({ directoryId }) => git.loadDirectoryGitState(directoryId),
    startDirectoryDiffStream: ({ directoryId, baseline, streamId, includeUntracked }) =>
      git.startDirectoryDiffStream(
        directoryId,
        baseline ?? null,
        streamId ?? null,
        includeUntracked ?? false,
      ),
    cancelDirectoryDiffStream: async ({ streamId }) => {
      await git.cancelDirectoryDiffStream(streamId)
      return undefined
    },
    getDirectoryDiffStats: ({ directoryId, baseline, includeUntracked }) =>
      git.loadDirectoryDiffStats(directoryId, baseline ?? null, includeUntracked ?? false),
    getDirectoryDiffImagePreview: (request) => git.loadDirectoryDiffImagePreview(request),
    getDirectoryDiffFileContents: (request) => git.loadDirectoryDiffFileContents(request),
    captureDirectoryDiffBaseline: ({ directoryId }) =>
      git.captureDirectoryDiffBaseline(directoryId),
    listDirectoryCommits: ({ directoryId, limit }) =>
      git.listDirectoryCommits(directoryId, limit ?? null),
  } satisfies Partial<DesktopRequestHandlerMap>
}
