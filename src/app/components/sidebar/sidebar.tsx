import { Tooltip } from '@howcode/common/tooltip'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { Code2, Inbox, MessageSquare, PanelLeftClose, Settings } from 'lucide-react'
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
import { SidebarChatSection } from './chat/sidebar-chat-section'
import { SidebarInboxSection } from './inbox/sidebar-inbox-section'
import { SidebarChatSkeleton, SidebarInboxSkeleton } from './sidebar-skeletons'
import { WorkSidebarSection } from './work-sidebar-section'

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
  selectedInboxSessionPath: string | null
  selectedProjectId: string
  selectedThreadId: string | null
  selectedChatGroupId: string | null
  settingsOpen: boolean
  projectScopeLockActive: boolean
  terminalRunningProjectIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  collapsedProjectIds: Record<string, boolean>
  onAction: DesktopActionInvoker
  onShowView: (view: SidebarNavigableView) => void
  onToggleSettings: () => void
  onOpenExtensionsView: () => void
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
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleProjectCollapse: (projectId: string) => void
  compactMode?: boolean
  onCloseCompactSidebar?: () => void
}

function isCodeModeActive(activeView: View) {
  return (
    activeView !== 'chat' &&
    activeView !== 'claw' &&
    activeView !== 'work' &&
    activeView !== 'automations'
  )
}

function SidebarModeNav({
  activeView,
  codeModeActive,
  onShowView,
}: {
  activeView: View
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
      <NavButton
        icon={<Code2 size={16} />}
        label="Code"
        active={codeModeActive && activeView !== 'inbox'}
        onClick={() => onShowView('code')}
      />
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
        terminalRunningSessionPaths={props.terminalRunningSessionPaths}
        threads={props.inboxThreads}
        selectedSessionPath={props.selectedInboxSessionPath}
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
  if (props.activeView !== 'extensions' && props.activeView !== 'skills') {
    return (
      <WorkSidebarSection
        activeView={props.activeView}
        loading={props.projectsLoading ?? false}
        projects={props.projects}
        projectGitState={props.projectGitState}
        initialVisibleProjectIds={props.sidebarVisibleProjectIds}
        selectedProjectId={props.selectedProjectId}
        selectedThreadId={props.selectedThreadId}
        terminalRunningProjectIds={props.terminalRunningProjectIds}
        terminalRunningSessionPaths={props.terminalRunningSessionPaths}
        onAction={props.onAction}
        appSettings={props.appSettings}
        onLoadProjectThreads={props.onLoadProjectThreads}
        onOpenSettingsPanel={props.onOpenSettingsPanel}
        onProjectSelect={props.onProjectSelect}
        onProjectPrimeSelection={props.onProjectPrimeSelection}
        onThreadOpen={props.onThreadOpen}
        onShowView={props.onShowView}
      />
    )
  }
  return (
    <WorkSidebarSection
      activeView={props.activeView}
      loading={props.projectsLoading ?? false}
      projects={props.projects}
      projectGitState={props.projectGitState}
      initialVisibleProjectIds={props.sidebarVisibleProjectIds}
      projectTargetMode={true}
      projectScopeLockActive={props.projectScopeLockActive}
      selectedProjectId={props.selectedProjectId}
      selectedThreadId={props.selectedThreadId}
      terminalRunningProjectIds={props.terminalRunningProjectIds}
      terminalRunningSessionPaths={props.terminalRunningSessionPaths}
      onAction={props.onAction}
      appSettings={props.appSettings}
      onLoadProjectThreads={props.onLoadProjectThreads}
      onOpenSettingsPanel={props.onOpenSettingsPanel}
      onProjectSelect={props.onProjectSelect}
      onProjectPrimeSelection={props.onProjectPrimeSelection}
      onProjectTargetSelected={props.onProjectTargetSelected}
      onThreadOpen={props.onThreadOpen}
      onShowView={props.onShowView}
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
  selectedInboxSessionPath,
  selectedProjectId,
  selectedThreadId,
  selectedChatGroupId,
  settingsOpen,
  projectScopeLockActive,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  collapsedProjectIds,
  onAction,
  onShowView,
  onToggleSettings,
  onOpenExtensionsView,
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
  onCloseCompactSidebar,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const settingsMenuId = 'sidebar-settings-menu'
  const settingsMenuPresent = useAnimatedPresence(settingsOpen)
  const codeModeActive = isCodeModeActive(activeView)
  const showModeSelection = activeView !== 'extensions' && activeView !== 'skills'
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
    selectedInboxSessionPath,
    selectedProjectId,
    selectedThreadId,
    selectedChatGroupId,
    settingsOpen,
    projectScopeLockActive,
    terminalRunningProjectIds,
    terminalRunningSessionPaths,
    collapsedProjectIds,
    onAction,
    onShowView,
    onToggleSettings,
    onOpenExtensionsView,
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
    ...(onCloseCompactSidebar ? { onCloseCompactSidebar } : {}),
  }

  return (
    <aside
      aria-label="Workspace sidebar"
      data-pulse-active={projectScopeLockActive ? 'true' : 'false'}
      data-project-target-mode={
        activeView === 'extensions' || activeView === 'skills' ? 'true' : 'false'
      }
      className="sidebar-shell motion-surface-pulse motion-sidebar-selection-pulse relative"
    >
      <div className="sidebar-shell-row sidebar-shell-row--top">
        {showModeSelection ? (
          <SidebarModeNav
            activeView={activeView}
            codeModeActive={codeModeActive}
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

          {compactMode && onCloseCompactSidebar ? (
            <Tooltip content="Hide sidebar" placement="right">
              <button
                type="button"
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
                onClick={onCloseCompactSidebar}
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
            onOpenExtensionsView={onOpenExtensionsView}
            onOpenAbout={onOpenAbout}
            onOpenSkillsView={onOpenSkillsView}
            onOpenSettingsPanel={onOpenSettingsPanel}
            onOpenArchivedThreads={onOpenArchivedThreads}
          />
        ) : null}
      </div>
    </aside>
  )
}
