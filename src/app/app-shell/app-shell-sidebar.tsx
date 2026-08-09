import { Sidebar } from '@howcode/sidebar'
import type { AppSettings } from '../desktop/types'
import type { AppShellController } from './useAppShellController'

type AppShellSidebarController = Pick<
  AppShellController,
  | 'app'
  | 'chat'
  | 'desktop'
  | 'inbox'
  | 'navigation'
  | 'projects'
  | 'resourceScope'
  | 'terminal'
  | 'thread'
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
  projectImportState: null,
  preferredProjectLocation: null,
  customPiDirectory: null,
  initializeGitOnProjectCreate: false,
  projectDashboardEnabled: true,
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'main-branch' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  gitDiffIncludeUntrackedDefault: false,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  devUpdateBranch: false,
  piTuiTakeover: false,
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
  const projectScopeLockActive =
    controller.resourceScope.extensionsActive || controller.resourceScope.skillsActive
  return (
    <Sidebar
      projects={controller.projects.items}
      inboxThreads={controller.inbox.threads}
      inboxLoading={controller.inbox.loading}
      chatSidebarLoading={controller.chat.loading}
      projectsLoading={controller.desktop.shellLoading}
      appLaunchedAtMs={controller.app.launchedAtMs}
      appSettings={controller.desktop.shellState?.appSettings ?? FALLBACK_APP_SETTINGS}
      projectGitState={controller.projects.gitState}
      sidebarVisibleProjectIds={controller.desktop.shellState?.sidebarVisibleProjectIds}
      chatSidebarState={controller.chat.state}
      activeView={state.activeView}
      protectedProjectId={
        controller.desktop.shellState?.resolvedCwd ?? controller.desktop.shellState?.cwd ?? null
      }
      selectedInboxSessionPath={state.selectedInboxSessionPath}
      selectedProjectId={state.selectedProjectId}
      selectedThreadId={state.selectedThreadId}
      selectedChatGroupId={controller.chat.selectedGroupId}
      settingsOpen={state.settingsOpen}
      projectScopeLockActive={projectScopeLockActive}
      terminalRunningWorkspaceIds={controller.terminal.runningWorkspaceIds}
      terminalRunningSessionPaths={controller.terminal.runningSessionPaths}
      collapsedProjectIds={controller.projects.collapsedIds}
      onAction={controller.desktop.handleAction}
      onShowView={controller.navigation.showView}
      onToggleSettings={controller.navigation.toggleSettings}
      onToggleSidebar={onToggle}
      onOpenExtensionsView={() => controller.navigation.showView('extensions')}
      onOpenAbout={controller.navigation.showLanding}
      onOpenSkillsView={() => controller.navigation.showView('skills')}
      onOpenSettingsPanel={(target) => controller.navigation.showView('settings', target)}
      onOpenArchivedThreads={() => controller.navigation.showView('archived')}
      onDismissInboxThread={controller.inbox.dismiss}
      onCreateChatGroup={controller.chat.createGroup}
      onSelectChatGroup={controller.chat.selectGroup}
      onNewChat={(groupId) => {
        controller.chat.selectGroup(groupId)
        void controller.desktop.handleAction('thread.new', { chatGroupId: groupId })
      }}
      onRefreshChatSidebar={controller.chat.refresh}
      onProjectSelect={controller.projects.select}
      onProjectPrimeSelection={controller.projects.primeSelection}
      onProjectTargetSelected={() => {
        if (state.activeView === 'extensions') controller.resourceScope.setExtensionsActive(true)
        if (state.activeView === 'skills') controller.resourceScope.setSkillsActive(true)
      }}
      onLoadProjectThreads={controller.projects.loadThreads}
      onSelectInboxThread={controller.inbox.select}
      onThreadOpen={controller.thread.open}
      onToggleProjectCollapse={controller.projects.toggleCollapse}
      compactMode={compactMode}
    />
  )
}
