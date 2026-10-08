import { GitReviewPanel } from '@howaboua/howcode-git/ui'
import { DraftInputContribution } from '../../composer/draft-input-contribution'
import { FALLBACK_APP_SETTINGS } from '../../workspace-shell/default-app-settings'
import type { DomainWorkspaceContentProps } from './domain-workspace-contract'

export function DomainWorkspaceGitReview(props: DomainWorkspaceContentProps) {
  const {
    shellState,
    directoryGitState,
    parentBranchName,
    composerDirectoryId,
    terminalConversationId,
    diffBaseline,
    diffRenderMode,
    gitOpsReview,
    diffLoadError,
    includeUntrackedDiffFiles,
    toggleIncludeUntrackedDiffFiles,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    setComposerLayoutVersion,
    handleAction,
    handleCloseGitOpsView,
    gitOpsFileTreeVisible,
    toggleGitOpsFileTree,
    controller,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <div>
      <GitReviewPanel
        appSettings={appSettings}
        directory={{
          id: composerDirectoryId,
          gitState: directoryGitState,
          parentBranchName,
          conversationId: terminalConversationId,
        }}
        diff={{
          baseline: diffBaseline,
          renderMode: diffRenderMode,
          loadError: diffLoadError,
          includeUntracked: includeUntrackedDiffFiles,
          setBaseline: onSetDiffBaseline,
          setRenderMode: onSetDiffRenderMode,
          toggleIncludeUntracked: toggleIncludeUntrackedDiffFiles,
        }}
        fileTree={{
          visible: gitOpsFileTreeVisible,
          toggle: toggleGitOpsFileTree,
        }}
        review={gitOpsReview}
        onReviewSent={handleCloseGitOpsView}
        onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
        onAction={handleAction}
        onBack={handleCloseGitOpsView}
        closeConfirmation={props.gitCloseConfirmation}
        renderDraftInput={(input) => (
          <DraftInputContribution
            {...input}
            activeView="chat"
            appSettings={appSettings}
            onAction={handleAction}
            onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
          />
        )}
      />
    </div>
  )
}
