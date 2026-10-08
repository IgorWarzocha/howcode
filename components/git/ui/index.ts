export { GitComposerControls } from './composer-controls'
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
  notifyDirectoryDiffInvalidated,
  useDirectoryDiffInvalidationVersion,
} from './hooks/directory-diff-invalidation'
export {
  cancelDirectoryDiffStreamQuery,
  canStartDirectoryDiffStreamQuery,
  getDirectoryDiffFileContentsQuery,
  getDirectoryDiffImagePreviewQuery,
  getDirectoryDiffStatsQuery,
  getDirectoryGitStateQuery,
  listDirectoryCommitsQuery,
  startDirectoryDiffStreamQuery,
} from './query'
export { useGitWorkspaceCommands } from './shell/commands'
export {
  invalidateDirectoryWorktreeQueries,
  useGitDesktopEventContribution,
} from './shell/desktop-events'
export type { DiffPreferencesPatch } from './shell/post-effects/diff-preferences'
export {
  applyDiffPreferencesPostEffect,
  applyDiffPreferencesToChat,
  getDiffPreferencesPatch,
} from './shell/post-effects/diff-preferences'
export {
  applyCommitOptionsPostEffect,
  applyWorkspaceCommitPostEffect,
  applyWorkspaceFileWritePostEffect,
} from './shell/post-effects/git'
export { gitPostEffectHandlers } from './shell/post-effects/git-handlers'
export {
  areDiffBaselinesEqual,
  useAppShellDiffPreferences,
} from './shell/useAppShellDiffPreferences'
export { useGitStateSync } from './shell/useGitStateSync'
export { useTerminalGitStateSync } from './shell/useTerminalGitStateSync'
export { createGitWorkspaceTransitions } from './shell/workspace-state'
export { useGitWorkspacePresentation } from './workspace/use-git-workspace-presentation'
export { useGitOpsFileActions } from './workspace/use-gitops-file-actions'
