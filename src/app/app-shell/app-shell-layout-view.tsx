import { Tooltip } from '@howaboua/howcode-sdk/common/tooltip'
import type { TerminalDrawerProps } from '@howaboua/howcode-sdk/terminal-renderer'
import { appToneTextClass, appTypeGroupTextClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { composeBuiltInWorkspaceViews } from '@howcode/component-system/built-in-workspace-views'
import { PanelLeftOpen, Settings } from 'lucide-react'
import type { RefObject } from 'react'
import { useContext } from 'react'
import { InstalledPageViews } from '../component-system/installed-providers'
import { RendererHostsContext } from '../component-system/installed-renderer-context'
import { RendererSlot } from '../component-system/renderer-slots'
import { useWorkspaceArtifactDrawerState } from '../workspace-shell/useWorkspaceArtifactDrawerState'
import { ArtifactDrawerViews } from '../workspace-shell/workspace-artifact-drawer'
import { AppShellNavigation } from './app-shell-navigation'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'

type AppShellLayoutViewProps = {
  controller: AppShellController
  mainSectionRef: RefObject<HTMLElement | null>
  sidebar: {
    available: boolean
    collapsed: boolean
    compactMode: boolean
    onOverlayOpenChange: (open: boolean) => void
    onToggle: () => void
    overlayOpen: boolean
  }
  terminal: {
    drawerPresent: boolean
    drawerVisible: boolean
    conversationId: string | null
  }
  workspaceContentClass: string
}

function InstalledTerminalDrawer(props: TerminalDrawerProps) {
  const renderer = useContext(RendererHostsContext).find(
    ({ contribution }) => contribution.TerminalDrawer,
  )
  const Content = renderer?.contribution.TerminalDrawer
  if (!(renderer?.host.enabled && Content)) return null
  return (
    <RendererSlot name={renderer.name}>
      <Content {...props} host={renderer.host} />
    </RendererSlot>
  )
}

function DesktopSidebarFrame(props: AppShellLayoutViewProps) {
  if (!props.sidebar.available) return null
  const hidden = props.sidebar.collapsed || props.sidebar.compactMode
  return (
    <div
      className={
        hidden
          ? 'relative w-0 min-w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out pointer-events-none'
          : 'relative w-[clamp(225px,calc(100vw_-_936px),300px)] min-w-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity] duration-200 ease-out'
      }
    >
      {hidden ? null : (
        <AppShellNavigation
          compactMode={props.sidebar.compactMode}
          controller={props.controller}
          onToggle={props.sidebar.onToggle}
        />
      )}
    </div>
  )
}

function CompactSidebarOverlay(props: AppShellLayoutViewProps) {
  if (!(props.sidebar.available && props.sidebar.compactMode && props.sidebar.overlayOpen))
    return null
  return (
    <button
      type="button"
      className="absolute inset-0 z-40 bg-transparent"
      aria-label="Close sidebar"
      onClick={() => props.sidebar.onOverlayOpenChange(false)}
    />
  )
}

function CompactSidebarPanel(props: AppShellLayoutViewProps) {
  if (!(props.sidebar.available && props.sidebar.compactMode)) return null
  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${props.sidebar.overlayOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
    >
      <AppShellNavigation
        compactMode={props.sidebar.compactMode}
        controller={props.controller}
        onToggle={props.sidebar.onToggle}
      />
    </div>
  )
}

function AppShellWorkspaceSection(props: AppShellLayoutViewProps) {
  const { mainSectionRef, controller, workspaceContentClass } = props
  const conversationId = controller.chat.activeData?.conversationId ?? props.terminal.conversationId
  const artifactDrawer = useWorkspaceArtifactDrawerState({
    conversationId,
    sidebarCompactMode: props.sidebar.compactMode,
  })
  const activeView = controller.workspace.state.activeView
  const installedPage = activeView.startsWith('component:') || activeView === 'skills'
  const retainedView = installedPage
    ? (controller.workspace.state.utilityViewReturnState?.activeView ?? 'chat')
    : activeView
  const presentationController = installedPage
    ? {
        ...controller,
        workspace: {
          ...controller.workspace,
          state: { ...controller.workspace.state, activeView: retainedView },
        },
      }
    : controller
  return (
    <section
      ref={mainSectionRef}
      className="flex min-w-0 min-h-0 h-full flex-1 flex-col overflow-hidden bg-[color:var(--workspace)]"
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {props.sidebar.available ? null : (
          <div className="flex shrink-0 justify-end px-2 py-1">
            <button
              type="button"
              className="inline-flex h-7 items-center gap-2 rounded-full px-2 text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={() =>
                controller.navigation.showView('settings', {
                  settingId: 'common.navigation-renderer',
                })
              }
              aria-label="Open sidebar settings"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          </div>
        )}
        {installedPage && (props.sidebar.collapsed || props.sidebar.compactMode) ? (
          <div className="flex shrink-0 px-2 py-1">
            <Tooltip content="Show sidebar" placement="right">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
                aria-label="Show sidebar"
                onClick={props.sidebar.onToggle}
              >
                <PanelLeftOpen size={15} />
              </button>
            </Tooltip>
          </div>
        ) : null}
        <InstalledPageViews
          activeView={activeView}
          onOpenWorkspace={controller.navigation.showWorkspace}
          onOpenConversation={(conversation) => {
            controller.workspaces.select(conversation.workspaceId)
            controller.chat.open(conversation.directoryId, conversation.id, conversation.id)
          }}
        />
        <div
          className="min-h-0 flex-1 flex-col overflow-hidden"
          style={{ display: installedPage ? 'none' : 'flex' }}
        >
          <AppShellWorkspace
            activeView={retainedView}
            contributions={composeBuiltInWorkspaceViews({
              artifactDrawer,
              controller: presentationController,
              activeComposerState: controller.composer.state,
              activeChatData: controller.chat.activeData,
              composerDirectoryId: controller.composer.directoryId,
              currentDirectoryName: controller.directories.currentName,
              terminalDrawerVisible: props.terminal.drawerVisible,
              terminalConversationId: props.terminal.conversationId,
              workspaceContentClass,
              sidebarCollapsed: props.sidebar.collapsed,
              sidebarAutoHidden: props.sidebar.compactMode,
              sidebarCompactMode: props.sidebar.compactMode,
              onToggleSidebar: props.sidebar.onToggle,
            })}
          />
        </div>
        <ArtifactDrawerViews artifactDrawer={artifactDrawer} conversationId={conversationId} />
        <InstalledTerminalDrawer
          drawerPresent={props.terminal.drawerPresent}
          drawerVisible={props.terminal.drawerVisible && !installedPage}
          compactMode={props.sidebar.compactMode}
          directoryId={controller.composer.directoryId}
          conversationId={props.terminal.conversationId}
          onClose={controller.terminal.closeDrawer}
          hoverToFocus={controller.desktop.shellState?.appSettings.hoverToFocus ?? true}
          hoverToBlur={controller.desktop.shellState?.appSettings.hoverToBlur ?? false}
        />
      </div>
    </section>
  )
}

function AppShellToast(props: AppShellLayoutViewProps) {
  const { controller } = props
  if (!controller.app.toast) return null
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 backdrop-blur-sm',
        appTypeGroupTextClass,
        appToneTextClass,
      )}
    >
      {controller.app.toast}
    </div>
  )
}

export function AppShellLayoutView(props: AppShellLayoutViewProps) {
  return (
    <>
      <div className={appShellRootClass}>
        <DesktopSidebarFrame {...props} />
        <CompactSidebarOverlay {...props} />
        <CompactSidebarPanel {...props} />
        <AppShellWorkspaceSection {...props} />
      </div>
      <AppShellToast {...props} />
    </>
  )
}
