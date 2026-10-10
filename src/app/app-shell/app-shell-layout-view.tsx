import { Tooltip } from '@howaboua/howcode-sdk/common/tooltip'
import { appToneTextClass, appTypeGroupTextClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { composeBuiltInWorkspaceViews } from '@howcode/component-system/built-in-workspace-views'
import { TerminalDrawerLayer } from '@howcode/components/terminal/ui'
import { PanelLeftOpen } from 'lucide-react'
import type { RefObject } from 'react'
import { InstalledPageViews } from '../component-system/installed-providers'
import type { DirectoryDiffBaseline, DirectoryDiffRenderMode } from '../desktop/types'
import { AppShellSidebar } from './app-shell-sidebar'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'

type AppShellLayoutViewProps = {
  controller: AppShellController
  diff: {
    baseline: DirectoryDiffBaseline
    onBaselineChange: (baseline: DirectoryDiffBaseline) => void
    onRenderModeChange: (renderMode: DirectoryDiffRenderMode) => void
    renderMode: DirectoryDiffRenderMode
  }
  mainSectionRef: RefObject<HTMLElement | null>
  sidebar: {
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

function DesktopSidebarFrame(props: AppShellLayoutViewProps) {
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
        <AppShellSidebar
          compactMode={props.sidebar.compactMode}
          controller={props.controller}
          onToggle={props.sidebar.onToggle}
        />
      )}
    </div>
  )
}

function CompactSidebarOverlay(props: AppShellLayoutViewProps) {
  if (!(props.sidebar.compactMode && props.sidebar.overlayOpen)) return null
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
  if (!props.sidebar.compactMode) return null
  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${props.sidebar.overlayOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
    >
      <AppShellSidebar
        compactMode={props.sidebar.compactMode}
        controller={props.controller}
        onToggle={props.sidebar.onToggle}
      />
    </div>
  )
}

function AppShellWorkspaceSection(props: AppShellLayoutViewProps) {
  const { mainSectionRef, controller, workspaceContentClass } = props
  const activeView = controller.workspace.state.activeView
  const installedPage = activeView.startsWith('component:')
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
        />
        <div
          className="min-h-0 flex-1 flex-col overflow-hidden"
          style={{ display: installedPage ? 'none' : 'flex' }}
        >
          <AppShellWorkspace
            activeView={retainedView}
            contributions={composeBuiltInWorkspaceViews({
              controller: presentationController,
              activeComposerState: controller.composer.state,
              activeChatData: controller.chat.activeData,
              composerDirectoryId: controller.composer.directoryId,
              currentDirectoryName: controller.directories.currentName,
              diffBaseline: props.diff.baseline,
              diffRenderMode: props.diff.renderMode,
              terminalDrawerVisible: props.terminal.drawerVisible,
              terminalConversationId: props.terminal.conversationId,
              workspaceContentClass,
              onSetDiffBaseline: props.diff.onBaselineChange,
              onSetDiffRenderMode: props.diff.onRenderModeChange,
              sidebarCollapsed: props.sidebar.collapsed,
              sidebarAutoHidden: props.sidebar.compactMode,
              sidebarCompactMode: props.sidebar.compactMode,
              onToggleSidebar: props.sidebar.onToggle,
            })}
          />
        </div>
        <TerminalDrawerLayer
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
