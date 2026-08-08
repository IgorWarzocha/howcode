import { useCallback } from 'react'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { getLayoutThreadSelection } from './app-shell-layout-model'
import { AppShellLayoutView } from './app-shell-layout-view'
import { useAppKeybindings } from './useAppKeybindings'
import type { AppShellController } from './useAppShellController'
import { useAppShellDiffPreferences } from './useAppShellDiffPreferences'
import { useAppShellLayoutState } from './useAppShellLayoutState'
import { useAppShellResponsiveLayout } from './useAppShellResponsiveLayout'
import { useTakeoverTerminalIdentity } from './useTakeoverTerminalIdentity'

type AppShellLayoutProps = {
  controller: AppShellController
}

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const { composerProjectId, state } = controller
  const {
    controllerRef,
    handleFocusComposer,
    handleFocusTerminal,
    handleOpenSidebar,
    handleToggleSidebar,
    setSidebarOverlayOpen,
    sidebarCollapsed,
    sidebarCompactMode,
    sidebarOverlayOpen,
    terminalHiddenByCompactResize,
  } = useAppShellResponsiveLayout(controller)
  const { sessionPath: terminalSessionPath, threadId: activeThreadId } =
    getLayoutThreadSelection(state)
  const takeoverVisible = state.takeoverVisible
  const terminalDrawerVisible =
    (state.activeView === 'thread' || state.activeView === 'project') &&
    state.terminalVisible &&
    !(sidebarCompactMode && terminalHiddenByCompactResize)
  const animatedTerminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible)
  const terminalDrawerPresent =
    sidebarCompactMode && terminalHiddenByCompactResize
      ? terminalDrawerVisible
      : animatedTerminalDrawerPresent
  const parentBranchName =
    controller.shellState?.projects.find((project) => project.id === composerProjectId)?.worktree
      ?.parentBranchName ?? null
  const { diffBaseline, diffRenderMode, handleSetDiffBaseline, handleSetDiffRenderMode } =
    useAppShellDiffPreferences({
      activeThreadId,
      composerProjectId,
      controller,
      parentBranchName,
      terminalSessionPath,
    })
  const { mainSectionRef, takeoverPresent, workspaceContentClass } = useAppShellLayoutState({
    takeoverVisible,
  })
  const takeoverTerminalKey = useTakeoverTerminalIdentity({
    activeView: state.activeView,
    composerProjectId,
    takeoverPresent,
    takeoverVisible,
    terminalSessionPath,
    threadId: activeThreadId,
  })
  const handleOpenGitOpsFromTakeover = useCallback(async () => {
    controllerRef.current.handleOpenGitOpsView()
    await controllerRef.current.handleCloseTakeoverTerminal({
      preserveSessionOverride: true,
      refreshThread: false,
    })
  }, [controllerRef])

  useAppKeybindings({
    controller,
    keybindings: controller.shellState?.appSettings.keybindings ?? {},
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
      takeover={{
        onOpenGitOps: handleOpenGitOpsFromTakeover,
        present: takeoverPresent,
        terminalKey: takeoverTerminalKey,
      }}
      terminal={{
        drawerPresent: terminalDrawerPresent,
        drawerVisible: terminalDrawerVisible,
        sessionPath: terminalSessionPath,
      }}
      workspaceContentClass={workspaceContentClass}
    />
  )
}
