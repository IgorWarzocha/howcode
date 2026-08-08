export {
  mergeProjectBranch,
  pruneProjectBranch,
  switchProjectBranch,
} from './project-git/branch-actions.ts'
export {
  commitProjectChanges,
  initializeProjectGit,
  setProjectOrigin,
} from './project-git/commit-actions.ts'
export {
  cancelProjectDiffStream,
  loadProjectDiffImagePreview,
  loadProjectDiffStats,
  prepareCommitMessageContext,
  startProjectDiffStream,
} from './project-git/commit-context.ts'
export { loadProjectDiffFileContents } from './project-git/file-content.ts'
export {
  getProjectFileWriteError,
  writeProjectTextFile,
} from './project-git/file-write.ts'
export { getProjectCommitEntry, listProjectCommits } from './project-git/project-commits.ts'
export {
  captureProjectDiffBaseline,
  resolveProjectDiffBaseline,
} from './project-git/project-diff-baselines.ts'
export { loadProjectGitState } from './project-git/project-state.ts'
export type { CommitMessageContext } from './project-git/types.ts'
export {
  createProjectWorktree,
  getMainWorktreePath,
  loadGitWorktrees,
  removeProjectWorktree,
} from './project-git/worktrees.ts'
