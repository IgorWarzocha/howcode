import { createServiceWork } from '../../../desktop/runtime/service-work.ts'
import type { DesktopAction } from '../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../shared/desktop-contracts.ts'
import type { GitService } from '../../../shared/desktop-service-contracts.ts'
import { handleGitDesktopAction } from './actions/git-actions.ts'
import type { GitMetadataPeers } from './dependencies.ts'
import { disposeDirectoryDiffStreams } from './directory-git/commit-context.ts'
import * as git from './directory-git.ts'
import { disposeWorkspaceOperations } from './keyed-workspace-operations.ts'

export { withRootGitMutation } from './directory-worktrees/root-git-mutation-gate.ts'

export function createGitService(peers: GitMetadataPeers) {
  const work = createServiceWork('Git')
  const run = work.run
  let disposal: Promise<void> | undefined
  const service: GitService = {
    loadDirectoryGitState: (id) => run(() => git.loadDirectoryGitState(id)),
    startDirectoryDiffStream: (...args) => run(() => git.startDirectoryDiffStream(...args)),
    cancelDirectoryDiffStream: (id) => run(() => git.cancelDirectoryDiffStream(id)),
    loadDirectoryDiffStats: (...args) => run(() => git.loadDirectoryDiffStats(...args)),
    loadDirectoryDiffImagePreview: (request) =>
      run(() => git.loadDirectoryDiffImagePreview(request)),
    loadDirectoryDiffFileContents: (request) =>
      run(() => git.loadDirectoryDiffFileContents(request)),
    captureDirectoryDiffBaseline: (id) => run(() => git.captureDirectoryDiffBaseline(id)),
    listDirectoryCommits: (...args) => run(() => git.listDirectoryCommits(...args)),
  }
  return {
    service,
    handleAction: (action: DesktopAction, payload: AnyDesktopActionPayload) =>
      run(() => handleGitDesktopAction(action, payload, peers)),
    dispose() {
      disposal ??= (async () => {
        await work.stop()
        await disposeDirectoryDiffStreams()
        await disposeWorkspaceOperations()
      })()
      return disposal
    },
  }
}

export { getActiveBranch, getOriginUrl, isGitRepository } from './directory-git/directory-state.ts'
export {
  formatGitCommandError,
  getNonInteractiveGitEnv,
  runGitWithOptions,
} from './directory-git/git-runner.ts'

export {
  captureGitCommonDirectoryIdentity,
  captureGitRepositoryIdentity,
  loadGitRepositoryIdentity,
} from './directory-git/repository-identity.ts'
export { type GitWorktreeEntry, loadGitWorktrees } from './directory-git/worktrees.ts'
export {
  createDirectoryWorktree,
  getMainWorktreePath,
  initializeDirectoryGit,
  mergeDirectoryBranch,
  pruneDirectoryBranch,
  removeDirectoryWorktree,
} from './directory-git.ts'

export { cleanupLegacyCheckpoints } from './legacy-checkpoints.ts'
