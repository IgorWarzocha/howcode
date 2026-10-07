import { Tooltip } from '@howcode/common/tooltip'
import { codingPlugin } from '@howcode/plugins/coding/ui/extension'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isToolkitExtensionEnabled } from '@howcode/shared/toolkit-extensions'
import { Inbox, MessageSquare, PanelLeftClose, Settings } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type {
  AppSettings,
  ChatSidebarState,
  DesktopActionInvoker,
  InboxThread,
  ProjectGitState,
} from '../../desktop/types'
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { Project, View } from '../../types'

type SidebarNavigableView = Exclude<View, 'gitops'>

import { AppMenu } from '@howcode/app-menu'
import { NavButton } from '@howcode/common/nav-button'
import { ProjectWorkSection } from '@howcode/plugins/coding/ui'
import { iconButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { SidebarChatSection } from './chat/sidebar-chat-section'
import { SidebarInboxSection } from './inbox/sidebar-inbox-section'
import { SidebarChatSkeleton, SidebarInboxSkeleton } from './sidebar-skeletons'

type SidebarProps = {
  projects: Project[]
  inboxThreads: InboxThread[]
  inboxLoading?: boolean
  chatSidebarState: ChatSidebarState | null
  chatSidebarLoading?: boolean
  projectsLoading?: boolean
  appLaunchedAtMs: number
  appSettings: AppSettings
  projectGitState: ProjectGitState | null
  sidebarVisibleProjectIds: string[] | null | undefined
  protectedProjectId?: string | null
  activeView: View
  selectedInboxConversationId: string | null
  selectedProjectId: string
  selectedThreadId: string | null
  selectedChatGroupId: string | null
  settingsOpen: boolean
  projectScopeLockActive: boolean
  terminalRunningWorkspaceIds: ReadonlySet<string>
  terminalRunningConversationIds: ReadonlySet<string>
  collapsedProjectIds: Record<string, boolean>
  onAction: DesktopActionInvoker
  onShowView: (view: SidebarNavigableView) => void
  onToggleSettings: () => void
  onToggleSidebar: () => void
  onOpenAbout: () => void
  onOpenSkillsView: () => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onOpenArchivedThreads: () => void
  onDismissInboxThread: (thread: InboxThread) => void
  onCreateChatGroup: (name: string) => Promise<unknown>
  onSelectChatGroup: (groupId: string | null) => void
  onNewChat: (groupId: string | null) => void
  onRefreshChatSidebar: () => Promise<unknown>
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onProjectTargetSelected?: (() => void) | undefined
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  onSelectInboxThread: (thread: InboxThread) => void
  onThreadOpen: (projectId: string, threadId: string, conversationId: string) => void
  onToggleProjectCollapse: (projectId: string) => void
  compactMode?: boolean
}

function isCodeModeActive(activeView: View) {
  return activeView !== 'chat' && activeView !== 'claw' && activeView !== 'work'
}

function SidebarModeNav({
  activeView,
  codeModeActive,
  appSettings,
  onShowView,
}: {
  activeView: View
  appSettings: AppSettings
  codeModeActive: boolean
  onShowView: (view: SidebarNavigableView) => void
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
        label="Chat"
        active={activeView === 'chat'}
        onClick={() => onShowView('chat')}
      />
      {isToolkitExtensionEnabled(appSettings, codingPlugin.id) ? (
        <NavButton
          icon={<codingPlugin.navigation.icon size={16} />}
          label={codingPlugin.navigation.label}
          active={codeModeActive && activeView !== 'inbox'}
          onClick={() => onShowView(codingPlugin.navigation.view)}
        />
      ) : null}
    </nav>
  )
}

function SidebarContent(props: SidebarProps) {
  if (props.activeView === 'inbox' && props.inboxLoading && props.inboxThreads.length === 0)
    return <SidebarInboxSkeleton />
  if (props.activeView === 'inbox') {
    return (
      <SidebarInboxSection
        appLaunchedAtMs={props.appLaunchedAtMs}
        terminalRunningConversationIds={props.terminalRunningConversationIds}
        threads={props.inboxThreads}
        selectedConversationId={props.selectedInboxConversationId}
        onAction={props.onAction}
        onDismissThread={props.onDismissInboxThread}
        onSelectThread={props.onSelectInboxThread}
      />
    )
  }
  if (props.activeView === 'chat' && props.chatSidebarLoading && !props.chatSidebarState)
    return <SidebarChatSkeleton />
  if (props.activeView === 'chat') {
    return (
      <SidebarChatSection
        chatState={props.chatSidebarState}
        selectedGroupId={props.selectedChatGroupId}
        selectedThreadId={props.selectedThreadId}
        onAction={props.onAction}
        onCreateGroup={props.onCreateChatGroup}
        onSelectGroup={props.onSelectChatGroup}
        onNewChat={props.onNewChat}
        onRefresh={props.onRefreshChatSidebar}
        onThreadOpen={props.onThreadOpen}
      />
    )
  }
  if (!isToolkitExtensionEnabled(props.appSettings, 'coding') && props.activeView !== 'skills')
    return null
  if (props.activeView !== 'skills') {
    return (
      <ProjectWorkSection
        activeView={props.activeView}
        loading={props.projectsLoading ?? false}
        projects={props.projects}
        projectGitState={props.projectGitState}
        collapsedProjectIds={props.collapsedProjectIds}
        initialVisibleProjectIds={props.sidebarVisibleProjectIds}
        selectedProjectId={props.selectedProjectId}
        selectedThreadId={props.selectedThreadId}
        terminalRunningWorkspaceIds={props.terminalRunningWorkspaceIds}
        terminalRunningConversationIds={props.terminalRunningConversationIds}
        onAction={props.onAction}
        appSettings={props.appSettings}
        onLoadProjectThreads={props.onLoadProjectThreads}
        onOpenSettingsPanel={props.onOpenSettingsPanel}
        onProjectSelect={props.onProjectSelect}
        onProjectPrimeSelection={props.onProjectPrimeSelection}
        onThreadOpen={props.onThreadOpen}
        onShowView={props.onShowView}
        onToggleProjectCollapse={props.onToggleProjectCollapse}
      />
    )
  }
  return (
    <ProjectWorkSection
      activeView={props.activeView}
      loading={props.projectsLoading ?? false}
      projects={props.projects}
      projectGitState={props.projectGitState}
      collapsedProjectIds={props.collapsedProjectIds}
      initialVisibleProjectIds={props.sidebarVisibleProjectIds}
      projectTargetMode={true}
      projectScopeLockActive={props.projectScopeLockActive}
      selectedProjectId={props.selectedProjectId}
      selectedThreadId={props.selectedThreadId}
      terminalRunningWorkspaceIds={props.terminalRunningWorkspaceIds}
      terminalRunningConversationIds={props.terminalRunningConversationIds}
      onAction={props.onAction}
      appSettings={props.appSettings}
      onLoadProjectThreads={props.onLoadProjectThreads}
      onOpenSettingsPanel={props.onOpenSettingsPanel}
      onProjectSelect={props.onProjectSelect}
      onProjectPrimeSelection={props.onProjectPrimeSelection}
      onProjectTargetSelected={props.onProjectTargetSelected}
      onThreadOpen={props.onThreadOpen}
      onShowView={props.onShowView}
      onToggleProjectCollapse={props.onToggleProjectCollapse}
    />
  )
}

export function Sidebar({
  projects,
  inboxThreads,
  inboxLoading = false,
  chatSidebarState,
  chatSidebarLoading = false,
  projectsLoading = false,
  appLaunchedAtMs,
  appSettings,
  projectGitState,
  sidebarVisibleProjectIds,
  protectedProjectId = null,
  activeView,
  selectedInboxConversationId,
  selectedProjectId,
  selectedThreadId,
  selectedChatGroupId,
  settingsOpen,
  projectScopeLockActive,
  terminalRunningWorkspaceIds,
  terminalRunningConversationIds,
  collapsedProjectIds,
  onAction,
  onShowView,
  onToggleSettings,
  onToggleSidebar,
  onOpenAbout,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  onDismissInboxThread,
  onCreateChatGroup,
  onSelectChatGroup,
  onNewChat,
  onRefreshChatSidebar,
  onProjectSelect,
  onProjectPrimeSelection,
  onProjectTargetSelected,
  onLoadProjectThreads,
  onSelectInboxThread,
  onThreadOpen,
  onToggleProjectCollapse,
  compactMode = false,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const settingsMenuId = 'sidebar-settings-menu'
  const settingsMenuPresent = useAnimatedPresence(settingsOpen)
  const codeModeActive = isCodeModeActive(activeView)
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
    projects,
    inboxThreads,
    inboxLoading,
    chatSidebarState,
    chatSidebarLoading,
    projectsLoading,
    appLaunchedAtMs,
    appSettings,
    projectGitState,
    sidebarVisibleProjectIds,
    protectedProjectId,
    activeView,
    selectedInboxConversationId,
    selectedProjectId,
    selectedThreadId,
    selectedChatGroupId,
    settingsOpen,
    projectScopeLockActive,
    terminalRunningWorkspaceIds,
    terminalRunningConversationIds,
    collapsedProjectIds,
    onAction,
    onShowView,
    onToggleSettings,
    onToggleSidebar,
    onOpenAbout,
    onOpenSkillsView,
    onOpenSettingsPanel,
    onOpenArchivedThreads,
    onDismissInboxThread,
    onCreateChatGroup,
    onSelectChatGroup,
    onNewChat,
    onRefreshChatSidebar,
    onProjectSelect,
    onProjectPrimeSelection,
    ...(onProjectTargetSelected ? { onProjectTargetSelected } : {}),
    onLoadProjectThreads,
    onSelectInboxThread,
    onThreadOpen,
    onToggleProjectCollapse,
    compactMode,
  }

  return (
    <aside
      aria-label="Workspace sidebar"
      data-pulse-active={projectScopeLockActive ? 'true' : 'false'}
      data-project-target-mode={activeView === 'skills' ? 'true' : 'false'}
      className="sidebar-shell motion-surface-pulse motion-sidebar-selection-pulse relative"
    >
      <div className="sidebar-shell-row sidebar-shell-row--top">
        {showModeSelection ? (
          <SidebarModeNav
            activeView={activeView}
            codeModeActive={codeModeActive}
            appSettings={appSettings}
            onShowView={onShowView}
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
            skillsEnabled={isToolkitExtensionEnabled(appSettings, 'skills')}
            onOpenSkillsView={onOpenSkillsView}
            onOpenSettingsPanel={onOpenSettingsPanel}
            onOpenArchivedThreads={onOpenArchivedThreads}
          />
        ) : null}
      </div>
    </aside>
  )
}
