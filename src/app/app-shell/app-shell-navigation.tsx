import type { NavigationProps } from '@howaboua/howcode-sdk/navigation'
import { useWorkspaceSurfaceHost } from '@howaboua/howcode-sdk/workspace-surfaces'
import { AppMenu } from '@howcode/app-menu'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import { useQueryClient } from '@tanstack/react-query'
import {
  InstalledSidebarActions,
  InstalledWorkspaceActions,
  InstalledWorkspaceSidebar,
} from '../component-system/conversation-contributions'
import { useInstalledPageViews } from '../component-system/installed-renderer-context'
import {
  classicNavigationRenderer,
  useNavigationRenderer,
} from '../component-system/navigation-selection'
import { RendererSlot } from '../component-system/renderer-slots'
import type { AppSettings } from '../desktop/types'
import { isBuiltInView } from '../types'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { useWorkspaceLayoutActions } from '../workspace-shell/workspace-layout-actions'
import { navigationDirectorySlots } from './navigation-directory-slots'
import type { AppShellController } from './useAppShellController'

type AppShellNavigationController = Pick<
  AppShellController,
  | 'composer'
  | 'app'
  | 'workspaces'
  | 'desktop'
  | 'inbox'
  | 'navigation'
  | 'directories'
  | 'resourceScope'
  | 'terminal'
  | 'chat'
  | 'workspace'
>

export function AppShellNavigation({
  compactMode,
  controller,
  onToggle,
}: {
  compactMode: boolean
  controller: AppShellNavigationController
  onToggle: () => void
}) {
  const queryClient = useQueryClient()
  const { state } = controller.workspace
  const appSettings: AppSettings =
    controller.desktop.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const renderer = useNavigationRenderer(
    appSettings.navigationRenderer ?? classicNavigationRenderer,
  )
  const pageViews = useInstalledPageViews()
  const layoutActions = useWorkspaceLayoutActions()
  const { host: workspaceHost } = useWorkspaceSurfaceHost()
  const Content = renderer?.contribution.navigation?.Content
  if (!(renderer && Content)) return null
  const props: NavigationProps = {
    host: renderer.host,
    ...navigationDirectorySlots(controller, appSettings, renderer.host, queryClient),
    pageViews: pageViews.map(({ name, id, view }) => ({ name, id, label: view.label })),
    sidebarActions: (
      <InstalledSidebarActions
        conversationId={state.activeView === 'chat' ? state.selectedChatId : null}
        onOpenConversation={(conversation) => {
          controller.workspaces.select(conversation.workspaceId)
          controller.chat.open(conversation.directoryId, conversation.id, conversation.id)
        }}
      />
    ),
    layoutActions,
    inboxChats: controller.inbox.chats,
    inboxLoading: controller.inbox.loading,
    workspaceNavigationLoading: controller.workspaces.loading,
    appLaunchedAtMs: controller.app.launchedAtMs,
    workspaceNavigationState: controller.workspaces.state,
    activeView: state.activeView,
    selectedInboxConversationId: state.selectedInboxConversationId,
    selectedChatId: state.selectedChatId,
    selectedWorkspaceId: controller.workspaces.selectedWorkspaceId,
    directoryScopeLockActive: controller.resourceScope.skillsActive,
    terminalRunningConversationIds: controller.terminal.runningConversationIds,
    onAction: controller.desktop.handleAction,
    onShowView: (view) => {
      if (isBuiltInView(view)) controller.navigation.showView(view)
      else {
        const page = pageViews.find(({ id }) => id === view)
        if (page) controller.navigation.showView(page.id)
      }
    },
    onShowWorkspace: () => {
      controller.navigation.showWorkspace()
      workspaceHost.selectMain('chat')
    },
    onToggleSidebar: onToggle,
    onDismissInboxChat: ({ conversationId }) => {
      const chat = controller.inbox.chats.find((item) => item.conversationId === conversationId)
      if (chat) controller.inbox.dismiss(chat)
    },
    onCreateWorkspace: controller.workspaces.create,
    onSelectWorkspace: controller.workspaces.select,
    onNewChat: (workspaceId) => {
      const workspace = controller.workspaces.state?.workspaces.find(
        (group) => group.id === workspaceId,
      )
      controller.workspaces.select(workspaceId)
      void controller.desktop.handleAction('chat.new', {
        workspaceId,
        directoryId: workspace?.directoryId ?? controller.desktop.shellState?.cwd,
      })
    },
    onSelectInboxChat: ({ conversationId }) => {
      const chat = controller.inbox.chats.find((item) => item.conversationId === conversationId)
      if (chat) controller.inbox.select(chat)
    },
    onChatOpen: controller.chat.open,
    compactMode,
    renderWorkspaceSidebar: (slot) => <InstalledWorkspaceSidebar {...slot} />,
    renderWorkspaceActions: (slot) => <InstalledWorkspaceActions {...slot} />,
    renderSettingsMenu: ({ menuId, open, panelRef, onClose }) => (
      <AppMenu
        menuId={menuId}
        open={open}
        panelRef={panelRef}
        skillsEnabled={
          pageViews.some(({ id }) => id === 'skills') &&
          isToolkitComponentEnabled(appSettings, 'skills')
        }
        onOpenAbout={() => {
          onClose()
          controller.navigation.showLanding()
        }}
        onOpenSkillsView={() => {
          onClose()
          controller.navigation.showView('skills')
        }}
        onOpenSettingsPanel={(target) => {
          onClose()
          controller.navigation.showView('settings', target)
        }}
        onOpenArchivedChats={() => {
          onClose()
          controller.navigation.showView('archived')
        }}
      />
    ),
  }
  return (
    <RendererSlot name={renderer.name}>
      <Content {...props} />
    </RendererSlot>
  )
}
