export type { CommitMessageContext } from "./project-git/types.cts";
export { loadProjectDiff, prepareCommitMessageContext } from "./project-git/commit-context.cts";
export {
  commitProjectChanges,
  initializeProjectGit,
  setProjectOrigin,
} from "./project-git/commit-actions.cts";
export { loadProjectGitState } from "./project-git/project-state.cts";
