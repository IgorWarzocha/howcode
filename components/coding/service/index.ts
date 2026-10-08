import { createServiceWork } from '../../../desktop/runtime/service-work.ts'
import type { CodingService } from '../../../shared/desktop-service-contracts.ts'
import { loadDirectoryUsageSummary } from './actions/directory-usage-summary.ts'
import { createCodingActionHandler } from './coding-actions.ts'
import { disposeCodingShell, loadCodingShell } from './coding-shell.ts'
import type { CodingPeers } from './dependencies.ts'
import { loadDirectoryFavicon } from './directory-favicon.ts'
import { disposeDirectoryDiffStreams } from './directory-git/commit-context.ts'
import * as git from './directory-git.ts'
import { disposeWorkspaceOperations } from './keyed-workspace-operations.ts'

export { cleanupLegacyCheckpoints } from './legacy-checkpoints.ts'

export function createCodingService(peers: CodingPeers) {
  const actions = createCodingActionHandler(peers)
  const work = createServiceWork('Coding')
  const run = work.run
  let disposal: Promise<void> | undefined

  const service: CodingService = {
    loadDirectoryGitState: (directoryId) => run(() => git.loadDirectoryGitState(directoryId)),
    loadDirectoryUsageSummary: (directoryId) => run(() => loadDirectoryUsageSummary(directoryId)),
    loadDirectoryFavicon: (directoryId) => run(() => loadDirectoryFavicon(directoryId)),
    startDirectoryDiffStream: (...args) => run(() => git.startDirectoryDiffStream(...args)),
    cancelDirectoryDiffStream: (streamId) => run(() => git.cancelDirectoryDiffStream(streamId)),
    loadDirectoryDiffStats: (...args) => run(() => git.loadDirectoryDiffStats(...args)),
    loadDirectoryDiffImagePreview: (request) =>
      run(() => git.loadDirectoryDiffImagePreview(request)),
    loadDirectoryDiffFileContents: (request) =>
      run(() => git.loadDirectoryDiffFileContents(request)),
    captureDirectoryDiffBaseline: (directoryId) =>
      run(() => git.captureDirectoryDiffBaseline(directoryId)),
    listDirectoryCommits: (...args) => run(() => git.listDirectoryCommits(...args)),
  }

  return {
    service,
    handleAction: (...args: Parameters<typeof actions.handleAction>) =>
      run(() => actions.handleAction(...args)),
    loadShell: (cwd: string) => run(() => loadCodingShell(cwd)),
    dispose() {
      disposal ??= (async () => {
        await work.stop()
        await Promise.all([
          disposeDirectoryDiffStreams(),
          disposeCodingShell(),
          disposeWorkspaceOperations(),
        ])
      })()
      return disposal
    },
  }
}
