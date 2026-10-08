import { Tooltip } from '@howcode/common/tooltip'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import { Inbox, MessageSquare, PanelLeftClose, Settings } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type {
  AppSettings,
  DesktopActionInvoker,
  DirectoryGitState,
  InboxChat,
  WorkspaceNavigationState,
} from '../../desktop/types'
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { View, WorkingDirectory } from '../../types'

type SidebarNavigableView = Exclude<View, 'gitops'>

import { AppMenu } from '@howcode/app-menu'
import { NavButton } from '@howcode/common/nav-button'
import {
  DirectoryWorkSection,
  WorkspaceFolderCreateButton,
} from '@howcode/components/working-directories/ui'
import { iconButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { SidebarInboxSection } from './inbox/sidebar-inbox-section'
import { SidebarChatSkeleton, SidebarInboxSkeleton } from './sidebar-skeletons'
import { WorkspaceNavigationSection } from './workspaces/workspace-navigation-section'

type SidebarProps = {
  directories: WorkingDirectory[]
  inboxChats: InboxChat[]
  inboxLoading?: boolean
  workspaceNavigationState: WorkspaceNavigationState | null
  workspaceNavigationLoading?: boolean
  directoriesLoading?: boolean
  appLaunchedAtMs: number
  appSettings: AppSettings
  directoryGitState: DirectoryGitState | null
  sidebarVisibleDirectoryIds: string[] | null | undefined
  protectedDirectoryId?: string | null
  activeView: View
  selectedInboxConversationId: string | null
  selectedDirectoryId: string
  selectedChatId: string | null
  selectedWorkspaceId: string | null
  settingsOpen: boolean
  directoryScopeLockActive: boolean
  terminalRunningWorkspaceIds: ReadonlySet<string>
  terminalRunningConversationIds: ReadonlySet<string>
  collapsedDirectoryIds: Record<string, boolean>
  onAction: DesktopActionInvoker
  onShowView: (view: SidebarNavigableView) => void
  onShowWorkspace: () => void
  onToggleSettings: () => void
  onToggleSidebar: () => void
  onOpenAbout: () => void
  onOpenSkillsView: () => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onOpenArchivedChats: () => void
  onDismissInboxChat: (chat: InboxChat) => void
  onCreateWorkspace: (name: string) => Promise<unknown>
  onSelectWorkspace: (workspaceId: string | null) => void
  onNewChat: (workspaceId: string | null) => void
  onDirectorySelect: (directoryId: string) => void
  onDirectoryPrimeSelection: (directoryId: string) => void
  onDirectoryTargetSelected?: (() => void) | undefined
  onLoadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null | undefined },
  ) => Promise<unknown>
  onSelectInboxChat: (chat: InboxChat) => void
  onChatOpen: (
    directoryId: string,
    chatId: string,
    conversationId: string,
    composerProfile?: 'general' | 'coding',
  ) => void
  onToggleDirectoryCollapse: (directoryId: string) => void
  compactMode?: boolean
}

function SidebarNavigation({
  activeView,
  onShowView,
  onShowWorkspace,
}: {
  activeView: View
  onShowView: (view: SidebarNavigableView) => void
  onShowWorkspace: () => void
}) {
  return (
    <nav className="sidebar-mode-nav" aria-label="Primary navigation">
      <NavButton
        icon={<Inbox size={16} />}
        label="Inbox"
        active={activeView === 'inbox'}
        onClick={() => onShowView('inbox')}
      />
      <NavButton
        icon={<MessageSquare size={16} />}
        label="Workspaces"
        active={activeView !== 'inbox'}
        onClick={onShowWorkspace}
      />
    </nav>
  )
}

function SidebarContent(props: SidebarProps) {
  if (props.activeView === 'inbox' && props.inboxLoading && props.inboxChats.length === 0)
    return <SidebarInboxSkeleton />
  if (props.activeView === 'inbox') {
    return (
      <SidebarInboxSection
        appLaunchedAtMs={props.appLaunchedAtMs}
        terminalRunningConversationIds={props.terminalRunningConversationIds}
        chats={props.inboxChats}
        selectedConversationId={props.selectedInboxConversationId}
        onAction={props.onAction}
        onDismissChat={props.onDismissInboxChat}
        onSelectChat={props.onSelectInboxChat}
      />
    )
  }
  if (
    props.activeView !== 'skills' &&
    props.workspaceNavigationLoading &&
    !props.workspaceNavigationState
  )
    return <SidebarChatSkeleton />
  if (props.activeView !== 'skills') {
    return (
      <WorkspaceNavigationSection
        chatState={props.workspaceNavigationState}
        selectedWorkspaceId={props.selectedWorkspaceId}
        selectedChatId={props.selectedChatId}
        onAction={props.onAction}
        onCreateWorkspace={props.onCreateWorkspace}
        onSelectWorkspace={props.onSelectWorkspace}
        onNewChat={props.onNewChat}
        onChatOpen={props.onChatOpen}
        folderCreation={
          isToolkitComponentEnabled(props.appSettings, 'coding') ? (
            <WorkspaceFolderCreateButton
              appSettings={props.appSettings}
              onAction={props.onAction}
              onOpenSettingsPanel={props.onOpenSettingsPanel}
            />
          ) : null
        }
        renderDirectoryTools={(directoryId) =>
          isToolkitComponentEnabled(props.appSettings, 'coding') ? (
            <li>
              <details className="mt-2">
                <summary className="sidebar-project-work-project-kicker cursor-pointer">
                  Git and worktrees
                </summary>
                <DirectoryWorkSection
                  key={directoryId}
                  embedded
                  activeView={props.activeView}
                  loading={props.directoriesLoading ?? false}
                  directories={props.directories.filter(
                    (directory) =>
                      directory.id === directoryId ||
                      directory.worktree?.rootDirectoryId === directoryId,
                  )}
                  directoryGitState={props.directoryGitState}
                  collapsedDirectoryIds={props.collapsedDirectoryIds}
                  initialVisibleDirectoryIds={[directoryId]}
                  selectedDirectoryId={directoryId}
                  selectedChatId={props.selectedChatId}
                  terminalRunningWorkspaceIds={props.terminalRunningWorkspaceIds}
                  terminalRunningConversationIds={props.terminalRunningConversationIds}
                  onAction={props.onAction}
                  appSettings={props.appSettings}
                  onLoadDirectoryChats={props.onLoadDirectoryChats}
                  onOpenSettingsPanel={props.onOpenSettingsPanel}
                  onDirectorySelect={props.onDirectorySelect}
                  onDirectoryPrimeSelection={props.onDirectoryPrimeSelection}
                  onChatOpen={(chatDirectoryId, chatId, conversationId) =>
                    props.onChatOpen(chatDirectoryId, chatId, conversationId, 'coding')
                  }
                  onShowView={props.onShowView}
                  onToggleDirectoryCollapse={props.onToggleDirectoryCollapse}
                />
              </details>
            </li>
          ) : null
        }
      />
    )
  }
  return (
    <DirectoryWorkSection
      activeView={props.activeView}
      loading={props.directoriesLoading ?? false}
      directories={props.directories}
      directoryGitState={props.directoryGitState}
      collapsedDirectoryIds={props.collapsedDirectoryIds}
      initialVisibleDirectoryIds={props.sidebarVisibleDirectoryIds}
      directoryTargetMode={true}
      directoryScopeLockActive={props.directoryScopeLockActive}
      selectedDirectoryId={props.selectedDirectoryId}
      selectedChatId={props.selectedChatId}
      terminalRunningWorkspaceIds={props.terminalRunningWorkspaceIds}
      terminalRunningConversationIds={props.terminalRunningConversationIds}
      onAction={props.onAction}
      appSettings={props.appSettings}
      onLoadDirectoryChats={props.onLoadDirectoryChats}
      onOpenSettingsPanel={props.onOpenSettingsPanel}
      onDirectorySelect={props.onDirectorySelect}
      onDirectoryPrimeSelection={props.onDirectoryPrimeSelection}
      onDirectoryTargetSelected={props.onDirectoryTargetSelected}
      onChatOpen={props.onChatOpen}
      onShowView={props.onShowView}
      onToggleDirectoryCollapse={props.onToggleDirectoryCollapse}
    />
  )
}

export function Sidebar({
  directories,
  inboxChats,
  inboxLoading = false,
  workspaceNavigationState,
  workspaceNavigationLoading = false,
  directoriesLoading = false,
  appLaunchedAtMs,
  appSettings,
  directoryGitState,
  sidebarVisibleDirectoryIds,
  protectedDirectoryId = null,
  activeView,
  selectedInboxConversationId,
  selectedDirectoryId,
  selectedChatId,
  selectedWorkspaceId,
  settingsOpen,
  directoryScopeLockActive,
  terminalRunningWorkspaceIds,
  terminalRunningConversationIds,
  collapsedDirectoryIds,
  onAction,
  onShowView,
  onToggleSettings,
  onShowWorkspace,
  onToggleSidebar,
  onOpenAbout,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedChats,
  onDismissInboxChat,
  onCreateWorkspace,
  onSelectWorkspace,
  onNewChat,
  onDirectorySelect,
  onDirectoryPrimeSelection,
  onDirectoryTargetSelected,
  onLoadDirectoryChats,
  onSelectInboxChat,
  onChatOpen,
  onToggleDirectoryCollapse,
  compactMode = false,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const settingsMenuId = 'sidebar-settings-menu'
  const settingsMenuPresent = useAnimatedPresence(settingsOpen)
  const showModeSelection = activeView !== 'skills'
  const closeSettings = useCallback(() => {
    if (settingsOpen) {
      onToggleSettings()
    }
  }, [onToggleSettings, settingsOpen])

  useDismissibleLayer({
    open: settingsOpen,
    onDismiss: closeSettings,
    refs: [settingsButtonRef, settingsMenuRef],
  })

  const sidebarContentProps: SidebarProps = {
    directories,
    inboxChats,
    inboxLoading,
    workspaceNavigationState,
    workspaceNavigationLoading,
    directoriesLoading,
    appLaunchedAtMs,
    appSettings,
    directoryGitState,
    sidebarVisibleDirectoryIds,
    protectedDirectoryId,
    activeView,
    selectedInboxConversationId,
    selectedDirectoryId,
    selectedChatId,
    selectedWorkspaceId,
    settingsOpen,
    directoryScopeLockActive,
    terminalRunningWorkspaceIds,
    terminalRunningConversationIds,
    collapsedDirectoryIds,
    onAction,
    onShowView,
    onShowWorkspace,
    onToggleSettings,
    onToggleSidebar,
    onOpenAbout,
    onOpenSkillsView,
    onOpenSettingsPanel,
    onOpenArchivedChats,
    onDismissInboxChat,
    onCreateWorkspace,
    onSelectWorkspace,
    onNewChat,
    onDirectorySelect,
    onDirectoryPrimeSelection,
    ...(onDirectoryTargetSelected ? { onDirectoryTargetSelected } : {}),
    onLoadDirectoryChats,
    onSelectInboxChat,
    onChatOpen,
    onToggleDirectoryCollapse,
    compactMode,
  }

  return (
    <aside
      aria-label="Workspace sidebar"
      data-pulse-active={directoryScopeLockActive ? 'true' : 'false'}
      data-directory-target-mode={activeView === 'skills' ? 'true' : 'false'}
      className="sidebar-shell motion-surface-pulse motion-sidebar-selection-pulse relative"
    >
      <div className="sidebar-shell-row sidebar-shell-row--top">
        {showModeSelection ? (
          <SidebarNavigation
            activeView={activeView}
            onShowView={onShowView}
            onShowWorkspace={onShowWorkspace}
          />
        ) : null}
      </div>

      <div className="sidebar-shell-row sidebar-shell-row--content">
        <SidebarContent {...sidebarContentProps} />
      </div>

      <div className="sidebar-shell-row sidebar-shell-row--footer sidebar-footer">
        <div className="flex items-center gap-1">
          <button
            ref={settingsButtonRef}
            type="button"
            className="sidebar-settings-button min-w-0 flex-1"
            onClick={onToggleSettings}
            data-open={settingsOpen ? 'true' : 'false'}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-controls={settingsMenuId}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          {compactMode ? (
            <Tooltip content="Hide sidebar" placement="right">
              <button
                type="button"
                className={cn(
                  iconButtonClass,
                  'h-[34px] w-[34px] shrink-0 rounded-[10px] opacity-80 hover:opacity-100',
                )}
                onClick={onToggleSidebar}
                aria-label="Hide sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </Tooltip>
          ) : null}
        </div>

        {settingsMenuPresent ? (
          <AppMenu
            menuId={settingsMenuId}
            open={settingsOpen}
            panelRef={settingsMenuRef}
            onOpenAbout={onOpenAbout}
            skillsEnabled={isToolkitComponentEnabled(appSettings, skillsComponent.id)}
            onOpenSkillsView={onOpenSkillsView}
            onOpenSettingsPanel={onOpenSettingsPanel}
            onOpenArchivedChats={onOpenArchivedChats}
          />
        ) : null}
      </div>
    </aside>
  )
}
