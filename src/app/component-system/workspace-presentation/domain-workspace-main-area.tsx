import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { mainPanelClass } from '@howcode/ui/classes'
import type { ReactNode } from 'react'
import type { View } from '../../types'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../../ui/layout'
import { FALLBACK_APP_SETTINGS } from '../../workspace-shell/default-app-settings'
import { WorkspaceSurfaceDock } from '../../workspace-shell/workspace-surface-dock'
import { RendererSlot } from '../renderer-slots'
import type { DomainWorkspaceContentProps } from './domain-workspace-contract'
import { DomainWorkspaceMainView } from './domain-workspace-main-view'

function getMainPanelClass(activeView: View, gitDetailOpen: boolean) {
  return activeView === 'chat' ||
    activeView === 'directories' ||
    activeView === 'inbox' ||
    gitDetailOpen
    ? 'min-h-0 overflow-hidden'
    : mainPanelClass
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
  const presentation = props.gitPresentation
  const detail = presentation?.detailOpen ? (
    <RendererSlot name="@howaboua/howcode-git">{presentation.detail}</RendererSlot>
  ) : null
  return (
    <div
      ref={props.artifactDrawer.desktopContentRef}
      className={cn(
        'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
        WORKSPACE_EDGE_PADDING_CLASS,
        props.artifactDrawer.artifactsFullscreen && 'hidden',
      )}
      style={{
        ...props.terminalDrawerInsetStyle,
        ...props.artifactDrawer.artifactDrawerInsetStyle,
        bottom: 0,
      }}
    >
      <WorkspaceSurfaceDock
        conversationId={
          props.state.activeView === 'chat' ? props.state.selectedConversationId : null
        }
        {...(presentation
          ? { layout: presentation.layout, onLayoutChange: presentation.updateLayout }
          : {})}
        detail={detail}
        footerInset={props.footerInset}
        detailLabel="Git diff"
      >
        {children}
      </WorkspaceSurfaceDock>
    </div>
  )
}
