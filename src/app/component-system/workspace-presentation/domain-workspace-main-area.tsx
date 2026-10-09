import { DiffPanel, GitDetailLayoutControls, useGitOpsFileActions } from '@howaboua/howcode-git/ui'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { mainPanelClass } from '@howcode/ui/classes'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { View } from '../../types'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../../ui/layout'
import { FALLBACK_APP_SETTINGS } from '../../workspace-shell/default-app-settings'
import { WorkspaceSurfaceDock } from '../../workspace-shell/workspace-surface-dock'
import type { DomainWorkspaceContentProps } from './domain-workspace-contract'
import { DomainWorkspaceGitReview } from './domain-workspace-git-review'
import { DomainWorkspaceMainView } from './domain-workspace-main-view'
import './domain-workspace-main-area.css'

function getMainPanelClass(activeView: View, gitDetailOpen: boolean) {
  return activeView === 'chat' ||
    activeView === 'directories' ||
    activeView === 'inbox' ||
    gitDetailOpen
    ? 'min-h-0 overflow-hidden'
    : mainPanelClass
}

function DomainWorkspaceGitDetail(props: DomainWorkspaceContentProps) {
  const fileActions = useGitOpsFileActions(props.handleAction)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < 680)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={viewportRef} className="git-detail-viewport min-h-0 min-w-0 flex-1 overflow-hidden">
      <DiffPanel
        fileActions={fileActions}
        directoryId={props.composerDirectoryId}
        isGitRepo={props.directoryGitState?.isGitRepo ?? false}
        baseline={props.diffBaseline}
        selectedFilePath={props.state.selectedDiffFilePath}
        selectedCommentId={props.gitOpsReview.selection.commentId}
        selectedCommentJumpKey={props.gitOpsReview.selection.jumpKey}
        diffRenderMode={narrow ? 'stacked' : props.diffRenderMode}
        layoutMode="main"
        showFileTree={props.gitOpsFileTreeVisible}
        includeUntracked={props.includeUntrackedDiffFiles}
        loading={props.controller.directories.gitLoading && !props.directoryGitState}
        onLoadErrorChange={props.setDiffLoadError}
      />
    </div>
  )
}

function getSelectedMainDirectoryId(
  state: DomainWorkspaceContentProps['controller']['workspace']['state'],
) {
  return (state.activeView === 'workspace' ||
    state.activeView === 'directory' ||
    state.activeView === 'history' ||
    state.activeView === 'skills') &&
    state.hasSelectedDirectory
    ? state.selectedDirectoryId
    : ''
}

function DomainWorkspaceDefaultMain(props: DomainWorkspaceContentProps) {
  const appSettings = props.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const selectedDirectoryId = getSelectedMainDirectoryId(props.controller.workspace.state)
  return (
    <DomainWorkspaceMainView
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

export function DomainWorkspaceMainArea(props: DomainWorkspaceContentProps) {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ bottom: `${props.footerInset}px` }}
    >
      <main
        ref={props.mainViewRef}
        className={cn(
          'h-full min-w-0',
          getMainPanelClass(props.state.activeView, props.gitDetailOpen),
        )}
      >
        <DomainWorkspaceDefaultMain {...props} />
      </main>
    </div>
  )
}

export function DomainWorkspaceLayout({
  children,
  ...props
}: DomainWorkspaceContentProps & { children: ReactNode }) {
  const detailLayout = props.gitDetailLayout
  const detail = props.gitDetailOpen ? (
    <>
      <GitDetailLayoutControls {...detailLayout} />
      <DomainWorkspaceGitDetail {...props} />
      <div className="git-detail-review shrink-0 border-t border-[color:var(--border)] p-2">
        <DomainWorkspaceGitReview {...props} />
      </div>
    </>
  ) : null
  return (
    <div
      className={cn(
        'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
        WORKSPACE_EDGE_PADDING_CLASS,
      )}
      style={{ ...props.terminalDrawerInsetStyle, bottom: 0 }}
    >
      <WorkspaceSurfaceDock
        layout={detailLayout.layout}
        onLayoutChange={detailLayout.updateLayout}
        detail={detail}
        footerInset={props.footerInset}
        detailLabel="Git diff"
      >
        {children}
      </WorkspaceSurfaceDock>
    </div>
  )
}
