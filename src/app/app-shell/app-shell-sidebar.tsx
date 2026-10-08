import { skillsComponent } from '@howcode/components/skills/ui/component'
import { Sidebar } from '@howcode/sidebar'
import type { AppSettings } from '../desktop/types'
import type { AppShellController } from './useAppShellController'

type AppShellSidebarController = Pick<
  AppShellController,
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

const FALLBACK_APP_SETTINGS = {
  chatModel: null,
  chatThinkingLevel: null,
  codeModel: null,
  codeThinkingLevel: null,
  gitCommitMessageModel: null,
  gitCommitMessageThinkingLevel: 'off',
  composerStreamingBehavior: 'followUp',
  dictationModelId: null,
  dictationMaxDurationSeconds: 180,
  showDictationButton: true,
  favoriteFolders: [],
  directoryImportState: null,
  preferredDirectoryLocation: null,
  customPiDirectory: null,
  initializeGitOnDirectoryCreate: false,
  directoryDashboardEnabled: true,
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'main-branch' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  gitDiffIncludeUntrackedDefault: false,
  directoryDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  hideSidebarSessionCounts: false,
  hoverToFocus: true,
  hoverToBlur: false,
  keybindings: {},
  composerSendMode: 'enter',
} satisfies AppSettings

export function AppShellSidebar({
  compactMode,
  controller,
  onToggle,
}: {
  compactMode: boolean
  controller: AppShellSidebarController
  onToggle: () => void
}) {
  const { state } = controller.workspace
  const directoryScopeLockActive = controller.resourceScope.skillsActive
  return (
    <Sidebar
      directories={controller.directories.items}
      inboxChats={controller.inbox.chats}
      inboxLoading={controller.inbox.loading}
      workspaceNavigationLoading={controller.workspaces.loading}
      directoriesLoading={controller.desktop.shellLoading}
      appLaunchedAtMs={controller.app.launchedAtMs}
      appSettings={controller.desktop.shellState?.appSettings ?? FALLBACK_APP_SETTINGS}
      directoryGitState={controller.directories.gitState}
      sidebarVisibleDirectoryIds={controller.desktop.shellState?.sidebarVisibleDirectoryIds}
      workspaceNavigationState={controller.workspaces.state}
      activeView={state.activeView}
      protectedDirectoryId={
        controller.desktop.shellState?.resolvedCwd ?? controller.desktop.shellState?.cwd ?? null
      }
      selectedInboxConversationId={state.selectedInboxConversationId}
      selectedDirectoryId={state.selectedDirectoryId}
      selectedChatId={state.selectedChatId}
      selectedWorkspaceId={controller.workspaces.selectedWorkspaceId}
      settingsOpen={state.settingsOpen}
      directoryScopeLockActive={directoryScopeLockActive}
      terminalRunningWorkspaceIds={controller.terminal.runningWorkspaceIds}
      terminalRunningConversationIds={controller.terminal.runningConversationIds}
      collapsedDirectoryIds={controller.directories.collapsedIds}
      onAction={controller.desktop.handleAction}
      onShowView={controller.navigation.showView}
      onShowWorkspace={controller.navigation.showWorkspace}
      onToggleSettings={controller.navigation.toggleSettings}
      onToggleSidebar={onToggle}
      onOpenAbout={controller.navigation.showLanding}
      onOpenSkillsView={() => controller.navigation.showView(skillsComponent.utility.view)}
      onOpenSettingsPanel={(target) => controller.navigation.showView('settings', target)}
      onOpenArchivedChats={() => controller.navigation.showView('archived')}
      onDismissInboxChat={controller.inbox.dismiss}
      onCreateWorkspace={controller.workspaces.create}
      onSelectWorkspace={controller.workspaces.select}
      onNewChat={(workspaceId) => {
        const workspace = controller.workspaces.state?.workspaces.find(
          (group) => group.id === workspaceId,
        )
        controller.workspaces.select(workspaceId)
        void controller.desktop.handleAction('chat.new', {
          workspaceId: workspaceId,
          composerProfile: workspace?.directoryId ? 'coding' : 'general',
          directoryId: workspace?.directoryId ?? controller.desktop.shellState?.cwd,
        })
      }}
      onDirectorySelect={controller.directories.select}
      onDirectoryPrimeSelection={controller.directories.primeSelection}
      onDirectoryTargetSelected={() => {
        if (state.activeView === 'skills') controller.resourceScope.setSkillsActive(true)
      }}
      onLoadDirectoryChats={controller.directories.loadChats}
      onSelectInboxChat={controller.inbox.select}
      onChatOpen={controller.chat.open}
      onToggleDirectoryCollapse={controller.directories.toggleCollapse}
      compactMode={compactMode}
    />
  )
}
