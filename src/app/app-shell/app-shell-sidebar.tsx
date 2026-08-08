import { Sidebar } from '@howcode/sidebar'
import type { AppSettings } from '../desktop/types'
import type { AppShellController } from './useAppShellController'

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
  controller: AppShellController
  onToggle: () => void
}) {
  const { state } = controller
  const projectScopeLockActive =
    controller.extensionsProjectScopeActive || controller.skillsProjectScopeActive
  return (
    <Sidebar
      projects={controller.projects}
      inboxThreads={controller.inboxThreads}
      inboxLoading={controller.inboxLoading}
      chatSidebarLoading={controller.chatSidebarLoading}
      projectsLoading={controller.shellLoading}
      appLaunchedAtMs={controller.appLaunchedAtMs}
      appSettings={controller.shellState?.appSettings ?? FALLBACK_APP_SETTINGS}
      projectGitState={controller.projectGitState}
      sidebarVisibleProjectIds={controller.shellState?.sidebarVisibleProjectIds}
      chatSidebarState={controller.chatSidebarState}
      activeView={state.activeView}
      protectedProjectId={controller.shellState?.resolvedCwd ?? controller.shellState?.cwd ?? null}
      selectedInboxSessionPath={state.selectedInboxSessionPath}
      selectedProjectId={state.selectedProjectId}
      selectedThreadId={state.selectedThreadId}
      selectedChatGroupId={controller.selectedChatGroupId}
      settingsOpen={state.settingsOpen}
      projectScopeLockActive={projectScopeLockActive}
      terminalRunningWorkspaceIds={controller.terminalRunningWorkspaceIds}
      terminalRunningSessionPaths={controller.terminalRunningSessionPaths}
      collapsedProjectIds={controller.collapsedProjectIds}
      onAction={controller.handleAction}
      onShowView={controller.handleShowView}
      onToggleSettings={controller.handleToggleSettings}
      onToggleSidebar={onToggle}
      onOpenExtensionsView={() => controller.handleShowView('extensions')}
      onOpenAbout={controller.handleShowLanding}
      onOpenSkillsView={() => controller.handleShowView('skills')}
      onOpenSettingsPanel={(target) => controller.handleShowView('settings', target)}
      onOpenArchivedThreads={() => controller.handleShowView('archived')}
      onDismissInboxThread={controller.handleDismissInboxThread}
      onCreateChatGroup={controller.handleCreateChatGroup}
      onSelectChatGroup={controller.handleSelectChatGroup}
      onNewChat={(groupId) => {
        controller.handleSelectChatGroup(groupId)
        void controller.handleAction('thread.new', { chatGroupId: groupId })
      }}
      onRefreshChatSidebar={controller.refreshChatSidebarState}
      onProjectSelect={controller.handleProjectSelect}
      onProjectPrimeSelection={controller.handleSetSelectedProject}
      onProjectTargetSelected={() => {
        if (state.activeView === 'extensions')
          controller.handleSetExtensionsProjectScopeActive(true)
        if (state.activeView === 'skills') controller.handleSetSkillsProjectScopeActive(true)
      }}
      onLoadProjectThreads={controller.handleLoadProjectThreads}
      onSelectInboxThread={controller.handleSelectInboxThread}
      onThreadOpen={controller.handleThreadOpen}
      onToggleProjectCollapse={controller.handleToggleProjectCollapse}
      compactMode={compactMode}
    />
  )
}
