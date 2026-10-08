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
  notifyDirectoryDiffInvalidated,
  useDirectoryDiffInvalidationVersion,
} from './hooks/directory-diff-invalidation'
export {
  cancelDirectoryDiffStreamQuery,
  canStartDirectoryDiffStreamQuery,
  getDirectoryDiffFileContentsQuery,
  getDirectoryDiffImagePreviewQuery,
  getDirectoryDiffStatsQuery,
  getDirectoryFaviconQuery,
  getDirectoryGitStateQuery,
  getDirectoryUsageSummaryQuery,
  listDirectoryCommitsQuery,
  listDirectoryDirectoryEntriesQuery,
  startDirectoryDiffStreamQuery,
} from './query'
export { useCodingWorkspaceCommands } from './shell/commands'
export {
  invalidateDirectoryWorktreeQueries,
  useCodingDesktopEventContribution,
} from './shell/desktop-events'
export {
  removeShellDirectoryFamily,
  removeShellWorktreeDirectory,
  setShellSidebarVisibleDirectoryIds,
  setShellWorktreeCompleted,
  setShellWorktreeDirectory,
  updateShellDirectory,
  upsertShellDirectory,
  upsertShellWorktreeDirectory,
} from './shell/directory-shell-cache'
export type { DiffPreferencesPatch } from './shell/post-effects/diff-preferences'
export {
  applyDiffPreferencesPostEffect,
  applyDiffPreferencesToChat,
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
  areDiffBaselinesEqual,
  useAppShellDiffPreferences,
} from './shell/useAppShellDiffPreferences'
export { useAppShellDirectoryState } from './shell/useAppShellDirectoryState'
export { useCodingGitStateSync } from './shell/useCodingGitStateSync'
export { useDirectoryRepoOriginRefresh } from './shell/useDirectoryRepoOriginRefresh'
export { useDirectoryShellSync } from './shell/useDirectoryShellSync'
export { useTerminalGitStateSync } from './shell/useTerminalGitStateSync'
export {
  clearCodingChatSelection,
  createCodingWorkspaceTransitions,
  createInitialCodingWorkspaceState,
  getCodingStateForOpenedChat,
  getCodingStateForPreviewedChat,
  getCodingStateForShownView,
  getCodingUtilityReturnState,
  getCurrentCodeChatSelection,
  resolveCodeChatSelection,
} from './shell/workspace-state'
export { WorkspaceFolderCreateButton } from './sidebar/directories/workspace-folder-create-button'
export { DirectoryWorkSection } from './sidebar/directory-work/directory-work-section'
