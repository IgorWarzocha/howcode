import { Tooltip } from '@howcode/common/tooltip'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
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
import { ProjectWorkSection, WorkspaceFolderCreateButton } from '@howcode/components/coding/ui'
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
  onShowWorkspace: () => void
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
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onProjectTargetSelected?: (() => void) | undefined
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  onSelectInboxThread: (thread: InboxThread) => void
  onThreadOpen: (
    projectId: string,
    threadId: string,
    conversationId: string,
    view?: 'chat' | 'thread',
  ) => void
  onToggleProjectCollapse: (projectId: string) => void
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
  if (props.activeView !== 'skills' && props.chatSidebarLoading && !props.chatSidebarState)
    return <SidebarChatSkeleton />
  if (props.activeView !== 'skills') {
    return (
      <SidebarChatSection
        chatState={props.chatSidebarState}
        selectedGroupId={props.selectedChatGroupId}
        selectedThreadId={props.selectedThreadId}
        onAction={props.onAction}
        onCreateGroup={async (name) => {
          await props.onCreateChatGroup(name)
          props.onShowWorkspace()
        }}
        onSelectGroup={props.onSelectChatGroup}
        onNewChat={props.onNewChat}
        onThreadOpen={props.onThreadOpen}
        onSelectDirectory={props.onProjectSelect}
        onShowWorkspace={props.onShowWorkspace}
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
                <ProjectWorkSection
                  key={directoryId}
                  embedded
                  activeView={props.activeView}
                  loading={props.projectsLoading ?? false}
                  projects={props.projects.filter(
                    (project) =>
                      project.id === directoryId || project.worktree?.rootProjectId === directoryId,
                  )}
                  projectGitState={props.projectGitState}
                  collapsedProjectIds={props.collapsedProjectIds}
                  initialVisibleProjectIds={[directoryId]}
                  selectedProjectId={directoryId}
                  selectedThreadId={props.selectedThreadId}
                  terminalRunningWorkspaceIds={props.terminalRunningWorkspaceIds}
                  terminalRunningConversationIds={props.terminalRunningConversationIds}
                  onAction={props.onAction}
                  appSettings={props.appSettings}
                  onLoadProjectThreads={props.onLoadProjectThreads}
                  onOpenSettingsPanel={props.onOpenSettingsPanel}
                  onProjectSelect={props.onProjectSelect}
                  onProjectPrimeSelection={props.onProjectPrimeSelection}
                  onThreadOpen={(projectId, threadId, conversationId) =>
                    props.onThreadOpen(projectId, threadId, conversationId, 'thread')
                  }
                  onShowView={props.onShowView}
                  onToggleProjectCollapse={props.onToggleProjectCollapse}
                />
              </details>
            </li>
          ) : null
        }
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
  onShowWorkspace,
  onToggleSidebar,
  onOpenAbout,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  onDismissInboxThread,
  onCreateChatGroup,
  onSelectChatGroup,
  onNewChat,
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
    onShowWorkspace,
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
            onOpenArchivedThreads={onOpenArchivedThreads}
          />
        ) : null}
      </div>
    </aside>
  )
}
