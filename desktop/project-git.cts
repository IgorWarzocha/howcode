export {
  commitProjectChanges,
  initializeProjectGit,
  setProjectOrigin,
} from './project-git/commit-actions.cts'
export {
  loadProjectDiff,
  loadProjectDiffStats,
  prepareCommitMessageContext,
} from './project-git/commit-context.cts'
export { getProjectCommitEntry, listProjectCommits } from './project-git/project-commits.cts'
export {
  captureProjectDiffBaseline,
  resolveProjectDiffBaseline,
} from './project-git/project-diff-baselines.cts'
export { loadProjectGitState } from './project-git/project-state.cts'
export type { CommitMessageContext } from './project-git/types.cts'
