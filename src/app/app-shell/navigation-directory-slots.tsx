import type { NavigationProps } from '@howaboua/howcode-sdk/navigation'
import type { PluginRendererHost } from '@howaboua/howcode-sdk/plugins'
import {
  getDirectoryFaviconQuery,
  listDirectoryDirectoryEntriesQuery,
  removeShellWorktreeDirectory,
  setShellWorktreeCompleted,
  setShellWorktreeDirectory,
  upsertShellWorktreeDirectory,
} from '@howcode/components/working-directories/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { AppSettings } from '../desktop/types'
import { getGitRendererApi } from '../git-integration/client'
import { desktopQueryKeys, subscribeDesktopEvents } from '../query/desktop-query'
import { listDesktopTerminals, subscribeDesktopTerminal } from '../terminal-client'
import { isBuiltInView } from '../types'
import type { AppShellController } from './useAppShellController'

const queries = {
  getFavicon: getDirectoryFaviconQuery,
  listFolders: listDirectoryDirectoryEntriesQuery,
}
const activity = {
  subscribeDesktop: subscribeDesktopEvents,
  listTerminals: listDesktopTerminals,
  subscribeTerminal: subscribeDesktopTerminal,
}

/** Core supplies folder/session authority; the admitted Sidebar owns Git policy and transient state. */
export function navigationDirectorySlots(
  controller: Pick<
    AppShellController,
    | 'app'
    | 'workspace'
    | 'desktop'
    | 'directories'
    | 'resourceScope'
    | 'terminal'
    | 'chat'
    | 'navigation'
    | 'composer'
    | 'workspaces'
  >,
  appSettings: AppSettings,
  host: PluginRendererHost,
  queryClient: QueryClient,
): Pick<NavigationProps, 'directoryTools'> {
  const state = controller.workspace.state
  return {
    directoryTools: {
      host,
      notify: controller.app.showToast,
      queries,
      activity,
      composerDirectoryId: controller.composer.directoryId,
      projection: {
        upsertWorktree: (input) => upsertShellWorktreeDirectory(queryClient, input),
        removeWorktree: (directoryId) => removeShellWorktreeDirectory(queryClient, directoryId),
        setWorktreeCompleted: (directoryId, completed) =>
          setShellWorktreeCompleted(queryClient, directoryId, completed),
        setWorktreeDirectory: (directoryId, location) =>
          setShellWorktreeDirectory(queryClient, directoryId, location),
        repositoryChanged: (directoryId) =>
          getGitRendererApi()?.invalidateDirectoryWorktreeQueries({ directoryId, queryClient }),
        refreshFolders: () =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: desktopQueryKeys.shellState() }),
            controller.workspaces.refresh(),
          ]),
      },
      activeView: state.activeView,
      loading: controller.desktop.shellLoading,
      directories: controller.directories.items,
      collapsedDirectoryIds: controller.directories.collapsedIds,
      initialVisibleDirectoryIds: controller.desktop.shellState?.sidebarVisibleDirectoryIds,
      selectedDirectoryId: state.selectedDirectoryId,
      selectedChatId: state.selectedChatId,
      terminalRunningWorkspaceIds: controller.terminal.runningWorkspaceIds,
      terminalRunningConversationIds: controller.terminal.runningConversationIds,
      onAction: controller.desktop.handleAction,
      appSettings,
      onLoadDirectoryChats: controller.directories.loadChats,
      onOpenSettingsPanel: (target) => controller.navigation.showView('settings', target),
      onDirectorySelect: controller.directories.select,
      onDirectoryPrimeSelection: controller.directories.primeSelection,
      onShowView: (view) => {
        if (isBuiltInView(view)) controller.navigation.showView(view)
      },
      onToggleDirectoryCollapse: controller.directories.toggleCollapse,
      onDirectoryTargetSelected: () => {
        if (state.activeView === 'skills') controller.resourceScope.setSkillsActive(true)
      },
      onChatOpen: controller.chat.open,
    },
  }
}
