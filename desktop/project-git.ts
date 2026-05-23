export { switchProjectBranch } from './project-git/branch-actions.ts'
export {
  commitProjectChanges,
  initializeProjectGit,
  setProjectOrigin,
} from './project-git/commit-actions.ts'
export {
  loadProjectDiff,
  loadProjectDiffImagePreview,
  loadProjectDiffStats,
  prepareCommitMessageContext,
} from './project-git/commit-context.ts'
export { getProjectCommitEntry, listProjectCommits } from './project-git/project-commits.ts'
export {
  captureProjectDiffBaseline,
  resolveProjectDiffBaseline,
} from './project-git/project-diff-baselines.ts'
export { loadProjectGitState } from './project-git/project-state.ts'
export type { CommitMessageContext } from './project-git/types.ts'
