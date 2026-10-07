import { createServiceWork } from '../../../desktop/runtime/service-work.ts'
import type { CodingService } from '../../../shared/desktop-service-contracts.ts'
import { loadProjectUsageSummary } from './actions/project-usage-summary.ts'
import { createCodingActionHandler } from './coding-actions.ts'
import { disposeCodingShell, loadCodingShell } from './coding-shell.ts'
import type { CodingPeers } from './dependencies.ts'
import { disposeWorkspaceOperations } from './keyed-workspace-operations.ts'
import { loadProjectFavicon } from './project-favicon.ts'
import { disposeProjectDiffStreams } from './project-git/commit-context.ts'
import * as git from './project-git.ts'

export { cleanupLegacyCheckpoints } from './legacy-checkpoints.ts'

export function createCodingService(peers: CodingPeers) {
  const actions = createCodingActionHandler(peers)
  const work = createServiceWork('Coding')
  const run = work.run
  let disposal: Promise<void> | undefined

  const service: CodingService = {
    loadProjectGitState: (projectId) => run(() => git.loadProjectGitState(projectId)),
    loadProjectUsageSummary: (projectId) => run(() => loadProjectUsageSummary(projectId)),
    loadProjectFavicon: (projectId) => run(() => loadProjectFavicon(projectId)),
    startProjectDiffStream: (...args) => run(() => git.startProjectDiffStream(...args)),
    cancelProjectDiffStream: (streamId) => run(() => git.cancelProjectDiffStream(streamId)),
    loadProjectDiffStats: (...args) => run(() => git.loadProjectDiffStats(...args)),
    loadProjectDiffImagePreview: (request) => run(() => git.loadProjectDiffImagePreview(request)),
    loadProjectDiffFileContents: (request) => run(() => git.loadProjectDiffFileContents(request)),
    captureProjectDiffBaseline: (projectId) => run(() => git.captureProjectDiffBaseline(projectId)),
    listProjectCommits: (...args) => run(() => git.listProjectCommits(...args)),
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
          disposeProjectDiffStreams(),
          disposeCodingShell(),
          disposeWorkspaceOperations(),
        ])
      })()
      return disposal
    },
  }
}
