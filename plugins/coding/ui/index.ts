export { CodingComposerControls } from './composer-controls'
export { BranchSwitchPopover } from './gitops/branch-switch-popover'
export { ComposerDiffBaselineSelector } from './gitops/composer-diff-baseline-selector'
export { defaultDiffBaseline } from './gitops/diff-baseline'
export { DiffPanel } from './gitops/diff-panel'
export type { GitOpsFileActions } from './gitops/edit/gitops-file-actions'
export { getGitOpsEntryButtonClass } from './gitops/git-ops'
export { GitOpsComposerPanel } from './gitops/git-ops-composer-panel'
export type { GitOpsReviewController } from './gitops/review/review-controller'
export type {
  DiffPoint,
  DiffSide,
  FileReviewTarget,
  LineRangeReviewTarget,
  ReviewDraft,
  ReviewTarget,
  SavedReviewComment,
} from './gitops/review/review-model'
export { buildReviewPrompt } from './gitops/review/review-prompt'
export {
  createReviewStore,
  decodePersistedReviewContext,
  getReviewContextId,
  type ReviewContext,
  type ReviewStore,
  reviewStore,
} from './gitops/review/review-store'
export { sendReviewCommentsToComposer } from './gitops/review/review-submission'

export {
  notifyProjectDiffInvalidated,
  useProjectDiffInvalidationVersion,
} from './hooks/project-diff-invalidation'
export {
  cancelProjectDiffStreamQuery,
  canStartProjectDiffStreamQuery,
  getProjectDiffFileContentsQuery,
  getProjectDiffImagePreviewQuery,
  getProjectDiffStatsQuery,
  getProjectFaviconQuery,
  getProjectGitStateQuery,
  getProjectUsageSummaryQuery,
  listProjectCommitsQuery,
  listProjectDirectoryEntriesQuery,
  startProjectDiffStreamQuery,
} from './query'
export { useCodingWorkspaceCommands } from './shell/commands'
export type { DiffPreferencesPatch } from './shell/post-effects/diff-preferences'
export {
  applyDiffPreferencesPostEffect,
  applyDiffPreferencesToThread,
  getDiffPreferencesPatch,
} from './shell/post-effects/diff-preferences'
export {
  applyCommitOptionsPostEffect,
  applyCreateWorktreePostEffect,
  applyRemoveWorktreePostEffect,
  applySwitchBranchPostEffect,
  applyWorkspaceCommitPostEffect,
  applyWorkspaceFileWritePostEffect,
  applyWorktreeMetadataPostEffect,
} from './shell/post-effects/workspace'
export { workspacePostEffectHandlers } from './shell/post-effects/workspace-handlers'
export {
  removeShellProjectFamily,
  removeShellWorktreeProject,
  setShellSidebarVisibleProjectIds,
  setShellWorktreeCompleted,
  setShellWorktreeDirectory,
  updateShellProject,
  upsertShellProject,
  upsertShellWorktreeProject,
} from './shell/project-shell-cache'
export {
  areDiffBaselinesEqual,
  useAppShellDiffPreferences,
} from './shell/useAppShellDiffPreferences'
export { useAppShellProjectState } from './shell/useAppShellProjectState'
export { useCodingGitStateSync } from './shell/useCodingGitStateSync'
export { useProjectRepoOriginRefresh } from './shell/useProjectRepoOriginRefresh'
export { useProjectShellSync } from './shell/useProjectShellSync'
export { useTerminalGitStateSync } from './shell/useTerminalGitStateSync'
export {
  createCodingWorkspaceTransitions,
  getCurrentCodeThreadSelection,
  resolveCodeThreadSelection,
} from './shell/workspace-state'
export { ProjectWorkSection } from './sidebar/project-work/project-work-section'
