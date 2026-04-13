export type { CommitMessageContext } from "./project-git/types.cts";
export {
  captureProjectDiffBaseline,
  resolveProjectDiffBaseline,
} from "./project-git/project-diff-baselines.cts";
export { getProjectCommitEntry, listProjectCommits } from "./project-git/project-commits.cts";
export {
  loadProjectDiff,
  loadProjectDiffStats,
  prepareCommitMessageContext,
} from "./project-git/commit-context.cts";
export {
  commitProjectChanges,
  initializeProjectGit,
  setProjectOrigin,
} from "./project-git/commit-actions.cts";
export { loadProjectGitState } from "./project-git/project-state.cts";
