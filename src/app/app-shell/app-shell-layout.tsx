import type { GitWorkspaceRendererPort } from '@howaboua/howcode-git/renderer-port'
import { usePublishGitRendererInput } from '@howaboua/howcode-sdk/git-renderer'
import { usePublishSidebarRendererInput } from '@howaboua/howcode-sdk/sidebar-renderer'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { useComposerDraftReceiver } from '../component-system/composer-draft-receiver'
import {
  classicNavigationRenderer,
  useNavigationRenderer,
} from '../component-system/navigation-selection'
import {
  useTerminalDrawerPresentation,
  useTerminalEnabled,
  useTerminalResponsiveState,
} from '../terminal-integration'
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from '../ui/layout'
import { getLayoutChatSelection } from './app-shell-layout-model'
import { AppShellLayoutView } from './app-shell-layout-view'
import { navigationDirectorySlots } from './navigation-directory-slots'
import { useAppKeybindings } from './useAppKeybindings'
import type { AppShellController } from './useAppShellController'
import { useAppShellResponsiveLayout } from './useAppShellResponsiveLayout'

type AppShellLayoutProps = {
  controller: AppShellController
}

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const queryClient = useQueryClient()
  const terminalEnabled = useTerminalEnabled(controller.desktop.shellState?.appSettings)
  const navigationRenderer = useNavigationRenderer(
    controller.desktop.shellState?.appSettings.navigationRenderer ?? classicNavigationRenderer,
  )
  const composerDirectoryId = controller.composer.directoryId
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
  } = useAppShellResponsiveLayout(terminalResponsive, Boolean(navigationRenderer))
  const { conversationId: terminalConversationId, chatId: activeChatId } =
    getLayoutChatSelection(state)
  const { receiver } = useComposerDraftReceiver()
  const prepareReview =
    receiver?.directoryId === composerDirectoryId &&
    receiver.conversationId === terminalConversationId
      ? receiver.append
      : undefined
  const { drawerVisible: terminalDrawerVisible, drawerPresent: terminalDrawerPresent } =
    useTerminalDrawerPresentation({
      enabled: terminalEnabled,
      activeView: state.activeView,
      visible: state.terminalVisible,
      compactMode: sidebarCompactMode,
      hiddenByCompactResize: terminalResponsive.hiddenByCompactResize,
    })
  const mainSectionRef = useRef<HTMLElement>(null)
  const shellState = controller.desktop.shellState
  const activeView =
    state.activeView.startsWith('component:') || state.activeView === 'skills'
      ? (state.utilityViewReturnState?.activeView ?? 'chat')
      : state.activeView
  const gitDetailOpen = Boolean(
    shellState &&
      ['chat', 'directory', 'workspace'].includes(activeView) &&
      composerDirectoryId &&
      state.gitDetailDirectoryId === composerDirectoryId,
  )
  const { handleAction } = controller.desktop
  const { open, close, openWorktreeFile } = controller.gitOps
  const directoryGitState = controller.directories.gitState
  const loading = controller.directories.gitLoading && !directoryGitState
  const gitPort = useMemo(
    (): GitWorkspaceRendererPort | undefined =>
      shellState
        ? {
            directoryId: composerDirectoryId,
            conversationId: terminalConversationId,
            directoryGitState,
            activeChatId,
            preferencesHost: {
              desktop: { shellState, handleAction },
              chat: { activeData: controller.chat.activeData },
            },
            settings: {
              appSettings: shellState.appSettings,
              availableModels: controller.composer.state?.availableModels ?? [],
              availableThinkingLevels: controller.composer.state?.availableThinkingLevels ?? [],
              currentModel: controller.composer.state?.currentModel ?? null,
              update: (payload) => handleAction('settings.update', payload),
            },
            detailOpen: gitDetailOpen,
            selectedFilePath: state.selectedDiffFilePath,
            loading,
            shellState: {
              appSettings: shellState.appSettings,
              directories: shellState.directories.map(({ id, worktree }) => ({
                id,
                ...(worktree
                  ? { worktree: { parentBranchName: worktree.parentBranchName ?? null } }
                  : {}),
              })),
            },
            onAction: handleAction,
            onOpenDetail: open,
            onCloseDetail: close,
            onOpenWorktreeFile: openWorktreeFile,
            ...(prepareReview ? { prepareReview } : {}),
          }
        : undefined,
    [
      shellState,
      composerDirectoryId,
      terminalConversationId,
      directoryGitState,
      activeChatId,
      controller.chat.activeData,
      controller.composer.state,
      gitDetailOpen,
      state.selectedDiffFilePath,
      loading,
      handleAction,
      open,
      close,
      openWorktreeFile,
      prepareReview,
    ],
  )
  usePublishGitRendererInput(gitPort)
  const sidebarInput = useMemo(
    () =>
      shellState && navigationRenderer
        ? navigationDirectorySlots(
            controller,
            shellState.appSettings,
            navigationRenderer.host,
            queryClient,
          ).directoryTools
        : undefined,
    [controller, shellState, navigationRenderer, queryClient],
  )
  usePublishSidebarRendererInput(sidebarInput)

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
        available: Boolean(navigationRenderer),
        collapsed: sidebarCollapsed,
        compactMode: sidebarCompactMode,
        onOverlayOpenChange: setSidebarOverlayOpen,
        onToggle: handleToggleSidebar,
        overlayOpen: sidebarOverlayOpen,
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
