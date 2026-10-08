import type { View } from '../../../../src/app/types'
import { mainPanelClass } from '../../../../src/app/ui/classes'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../../../../src/app/ui/layout'
import { cn } from '../../../../src/app/utils/cn'
import { FALLBACK_APP_SETTINGS } from '../../../../src/app/workspace-shell/default-app-settings'
import { DiffPanel } from '../gitops/index'
import type { CodeWorkspaceContentProps } from './code-workspace-contract'
import { CodeWorkspaceMainView } from './code-workspace-main-view'
import { useGitOpsFileActions } from './use-gitops-file-actions'

function getMainPanelClass(activeView: View, showDiffInMainView: boolean) {
  return activeView === 'chat' ||
    activeView === 'directories' ||
    activeView === 'inbox' ||
    showDiffInMainView
    ? 'min-h-0 overflow-hidden'
    : mainPanelClass
}

function CodeWorkspaceDiffMain(props: CodeWorkspaceContentProps) {
  const fileActions = useGitOpsFileActions(props.handleAction)
  return (
    <DiffPanel
      fileActions={fileActions}
      directoryId={props.composerDirectoryId}
      isGitRepo={props.directoryGitState?.isGitRepo ?? false}
      baseline={props.diffBaseline}
      selectedFilePath={props.state.selectedDiffFilePath}
      selectedCommentId={props.gitOpsReview.selection.commentId}
      selectedCommentJumpKey={props.gitOpsReview.selection.jumpKey}
      diffRenderMode={props.diffRenderMode}
      layoutMode="main"
      showFileTree={props.gitOpsFileTreeVisible}
      includeUntracked={props.includeUntrackedDiffFiles}
      loading={props.controller.directories.gitLoading && !props.directoryGitState}
      onLoadErrorChange={props.setDiffLoadError}
    />
  )
}

function getSelectedMainDirectoryId(
  state: CodeWorkspaceContentProps['controller']['workspace']['state'],
) {
  return (state.activeView === 'workspace' ||
    state.activeView === 'directory' ||
    state.activeView === 'history' ||
    state.activeView === 'skills') &&
    state.hasSelectedDirectory
    ? state.selectedDirectoryId
    : ''
}

function CodeWorkspaceDefaultMain(props: CodeWorkspaceContentProps) {
  const appSettings = props.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const selectedDirectoryId = getSelectedMainDirectoryId(props.controller.workspace.state)
  return (
    <CodeWorkspaceMainView
      activeView={props.state.activeView}
      appSettings={appSettings}
      currentDirectoryName={props.currentDirectoryName}
      directories={props.controller.directories.items}
      directoryGitState={props.directoryGitState}
      selectedDirectoryId={selectedDirectoryId}
      workspaceContentClass={props.workspaceContentClass}
      chatData={props.activeChatData}
      chatLoading={props.chatTimelineLoading}
      composerLayoutVersion={props.composerLayoutVersion}
      composerOverlayHeight={props.composerOverlayHeight}
      onAction={props.handleAction}
      onOpenChat={props.controller.chat.open}
      onCloseUtilityView={props.controller.navigation.closeUtilityView}
      onLoadEarlierMessages={props.handleLoadEarlierMessages}
      onSelectDirectory={props.controller.directories.select}
    />
  )
}

export function CodeWorkspaceMainArea(props: CodeWorkspaceContentProps) {
  return (
    <div
      className={cn(
        'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
        WORKSPACE_EDGE_PADDING_CLASS,
      )}
      style={{ ...props.terminalDrawerInsetStyle, bottom: `${props.footerInset}px` }}
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
        <main
          ref={props.mainViewRef}
          className={getMainPanelClass(props.state.activeView, props.showDiffInMainView)}
        >
          {props.showDiffInMainView ? (
            <CodeWorkspaceDiffMain {...props} />
          ) : (
            <CodeWorkspaceDefaultMain {...props} />
          )}
        </main>
      </div>
    </div>
  )
}
