import { useAppShellDiffPreferences } from '@howcode/components/coding/ui'
import {
  useTerminalDrawerPresentation,
  useTerminalResponsiveState,
} from '@howcode/components/terminal/ui'
import { useRef } from 'react'
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from '../ui/layout'
import { getLayoutThreadSelection } from './app-shell-layout-model'
import { AppShellLayoutView } from './app-shell-layout-view'
import { useAppKeybindings } from './useAppKeybindings'
import type { AppShellController } from './useAppShellController'
import { useAppShellResponsiveLayout } from './useAppShellResponsiveLayout'

type AppShellLayoutProps = {
  controller: AppShellController
}

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const composerProjectId = controller.composer.projectId
  const { state } = controller.workspace
  const terminalResponsive = useTerminalResponsiveState(
    state.terminalVisible,
    controller.terminal.closeDrawer,
  )
  const {
    handleFocusComposer,
    handleFocusTerminal,
    handleOpenSidebar,
    handleToggleSidebar,
    setSidebarOverlayOpen,
    sidebarCollapsed,
    sidebarCompactMode,
    sidebarOverlayOpen,
  } = useAppShellResponsiveLayout(controller, terminalResponsive)
  const { conversationId: terminalConversationId, threadId: activeThreadId } =
    getLayoutThreadSelection(state)
  const { drawerVisible: terminalDrawerVisible, drawerPresent: terminalDrawerPresent } =
    useTerminalDrawerPresentation({
      activeView: state.activeView,
      visible: state.terminalVisible,
      compactMode: sidebarCompactMode,
      hiddenByCompactResize: terminalResponsive.hiddenByCompactResize,
    })
  const parentBranchName =
    controller.desktop.shellState?.projects.find((project) => project.id === composerProjectId)
      ?.worktree?.parentBranchName ?? null
  const { diffBaseline, diffRenderMode, handleSetDiffBaseline, handleSetDiffRenderMode } =
    useAppShellDiffPreferences({
      activeThreadId,
      composerProjectId,
      controller,
      parentBranchName,
      terminalConversationId,
    })
  const mainSectionRef = useRef<HTMLElement>(null)

  useAppKeybindings({
    controller,
    keybindings: controller.desktop.shellState?.appSettings.keybindings ?? {},
    onFocusComposer: handleFocusComposer,
    onFocusTerminal: handleFocusTerminal,
    onOpenSidebar: handleOpenSidebar,
    onToggleSidebar: handleToggleSidebar,
  })

  return (
    <AppShellLayoutView
      controller={controller}
      mainSectionRef={mainSectionRef}
      sidebar={{
        collapsed: sidebarCollapsed,
        compactMode: sidebarCompactMode,
        onOverlayOpenChange: setSidebarOverlayOpen,
        onToggle: handleToggleSidebar,
        overlayOpen: sidebarOverlayOpen,
      }}
      diff={{
        baseline: diffBaseline,
        onBaselineChange: handleSetDiffBaseline,
        onRenderModeChange: handleSetDiffRenderMode,
        renderMode: diffRenderMode,
      }}
      terminal={{
        drawerPresent: terminalDrawerPresent,
        drawerVisible: terminalDrawerVisible,
        conversationId: terminalConversationId,
      }}
      workspaceContentClass={`mx-auto w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS}`}
    />
  )
}
