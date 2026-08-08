import { Sidebar } from '@howcode/sidebar'
import { TerminalPanel } from '@howcode/workspace-shell'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { appToneTextClass, appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { AppShellOverlays } from './app-shell-overlays'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'

type AppShellLayoutViewProps = {
  controller: AppShellController
  projects: AppShellController['projects']
  state: AppShellController['state']
  projectScopeLockActive: boolean
  collapsedProjectIds: Record<string, boolean>
  handleAction: AppShellController['handleAction']
  handleShowView: AppShellController['handleShowView']
  handleToggleSettings: AppShellController['handleToggleSettings']
  handleProjectSelect: AppShellController['handleProjectSelect']
  handleSetSelectedProject: AppShellController['handleSetSelectedProject']
  handleThreadOpen: AppShellController['handleThreadOpen']
  handleToggleProjectCollapse: AppShellController['handleToggleProjectCollapse']
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  sidebarOverlayOpen: boolean
  setSidebarOverlayOpen: Dispatch<SetStateAction<boolean>>
  handleToggleSidebar: () => void
  mainSectionRef: RefObject<HTMLElement | null>
  takeoverVisible: boolean
  activeComposerState: AppShellController['activeComposerState']
  activePiExtensionUiState: AppShellController['activePiExtensionUiState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  handleSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  handleSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  takeoverPresent: boolean
  takeoverTerminalKey: string
  handleOpenGitOpsFromTakeover: () => Promise<void>
  terminalDrawerPresent: boolean
}

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

function AppShellSidebar(props: AppShellLayoutViewProps) {
  const {
    controller,
    projects,
    state,
    projectScopeLockActive,
    collapsedProjectIds,
    handleAction,
    handleShowView,
    handleToggleSettings,
    handleToggleSidebar,
    handleProjectSelect,
    handleSetSelectedProject,
    handleThreadOpen,
    handleToggleProjectCollapse,
  } = props
  return (
    <Sidebar
      projects={projects}
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
      collapsedProjectIds={collapsedProjectIds}
      onAction={handleAction}
      onShowView={handleShowView}
      onToggleSettings={handleToggleSettings}
      onToggleSidebar={handleToggleSidebar}
      onOpenExtensionsView={() => handleShowView('extensions')}
      onOpenAbout={controller.handleShowLanding}
      onOpenSkillsView={() => handleShowView('skills')}
      onOpenSettingsPanel={(target) => handleShowView('settings', target)}
      onOpenArchivedThreads={() => handleShowView('archived')}
      onDismissInboxThread={controller.handleDismissInboxThread}
      onCreateChatGroup={controller.handleCreateChatGroup}
      onSelectChatGroup={controller.handleSelectChatGroup}
      onNewChat={(groupId) => {
        controller.handleSelectChatGroup(groupId)
        void handleAction('thread.new', { chatGroupId: groupId })
      }}
      onRefreshChatSidebar={controller.refreshChatSidebarState}
      onProjectSelect={handleProjectSelect}
      onProjectPrimeSelection={handleSetSelectedProject}
      onProjectTargetSelected={() => {
        if (state.activeView === 'extensions')
          controller.handleSetExtensionsProjectScopeActive(true)
        if (state.activeView === 'skills') controller.handleSetSkillsProjectScopeActive(true)
      }}
      onLoadProjectThreads={controller.handleLoadProjectThreads}
      onSelectInboxThread={controller.handleSelectInboxThread}
      onThreadOpen={handleThreadOpen}
      onToggleProjectCollapse={handleToggleProjectCollapse}
      compactMode={props.sidebarCompactMode}
    />
  )
}

function DesktopSidebarFrame(props: AppShellLayoutViewProps) {
  const { sidebarCollapsed, sidebarCompactMode } = props
  const hidden = sidebarCollapsed || sidebarCompactMode
  return (
    <div
      className={
        hidden
          ? 'relative w-0 min-w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out pointer-events-none'
          : 'relative w-[clamp(225px,calc(100vw_-_936px),300px)] min-w-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity] duration-200 ease-out'
      }
    >
      {hidden ? null : <AppShellSidebar {...props} />}
    </div>
  )
}

function CompactSidebarOverlay(props: AppShellLayoutViewProps) {
  const { sidebarCompactMode, sidebarOverlayOpen, setSidebarOverlayOpen } = props
  if (!(sidebarCompactMode && sidebarOverlayOpen)) return null
  return (
    <button
      type="button"
      className="absolute inset-0 z-40 bg-transparent"
      aria-label="Close sidebar"
      onClick={() => setSidebarOverlayOpen(false)}
    />
  )
}

function CompactSidebarPanel(props: AppShellLayoutViewProps) {
  const { sidebarCompactMode, sidebarOverlayOpen } = props
  if (!sidebarCompactMode) return null
  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${sidebarOverlayOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
    >
      <AppShellSidebar {...props} />
    </div>
  )
}

function AppShellWorkspaceSection(props: AppShellLayoutViewProps) {
  const {
    mainSectionRef,
    takeoverVisible,
    controller,
    activeComposerState,
    activeThreadData,
    composerProjectId,
    currentProjectName,
    diffBaseline,
    diffRenderMode,
    terminalDrawerVisible,
    terminalSessionPath,
    workspaceContentClass,
    handleSetDiffBaseline,
    handleSetDiffRenderMode,
    sidebarCollapsed,
    sidebarCompactMode,
    handleToggleSidebar,
    takeoverPresent,
    takeoverTerminalKey,
    handleOpenGitOpsFromTakeover,
  } = props
  return (
    <section
      ref={mainSectionRef}
      className="flex min-w-0 min-h-0 h-full flex-1 flex-col overflow-hidden bg-[color:var(--workspace)]"
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          data-open={takeoverVisible ? 'false' : 'true'}
          className="motion-desktop-workspace flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <AppShellWorkspace
            controller={controller}
            activeComposerState={activeComposerState}
            activePiExtensionUiState={props.activePiExtensionUiState}
            activeThreadData={activeThreadData}
            composerProjectId={composerProjectId}
            currentProjectName={currentProjectName}
            diffBaseline={diffBaseline}
            diffRenderMode={diffRenderMode}
            terminalDrawerVisible={terminalDrawerVisible}
            terminalSessionPath={terminalSessionPath}
            workspaceContentClass={workspaceContentClass}
            onSetDiffBaseline={handleSetDiffBaseline}
            onSetDiffRenderMode={handleSetDiffRenderMode}
            sidebarCollapsed={sidebarCollapsed}
            sidebarAutoHidden={sidebarCompactMode}
            sidebarCompactMode={sidebarCompactMode}
            onToggleSidebar={handleToggleSidebar}
          />
        </div>
        <AppShellOverlays
          controller={controller}
          composerProjectId={composerProjectId}
          diffBaseline={diffBaseline}
          takeoverPresent={takeoverPresent}
          takeoverVisible={takeoverVisible}
          takeoverTerminalKey={takeoverTerminalKey}
          terminalDrawerVisible={terminalDrawerVisible}
          terminalSessionPath={terminalSessionPath}
          terminalDrawerOverlay={sidebarCompactMode}
          sidebarCollapsed={sidebarCollapsed}
          sidebarCompactMode={sidebarCompactMode}
          sidebarOverlayOpen={props.sidebarOverlayOpen}
          onToggleSidebar={handleToggleSidebar}
          onOpenGitOps={handleOpenGitOpsFromTakeover}
          onSetDiffBaseline={handleSetDiffBaseline}
        />
        <TerminalDrawerLayer {...props} />
      </div>
    </section>
  )
}

function TerminalDrawerLayer(props: AppShellLayoutViewProps) {
  const {
    terminalDrawerPresent,
    sidebarCompactMode,
    terminalDrawerVisible,
    composerProjectId,
    terminalSessionPath,
    controller,
  } = props
  if (!terminalDrawerPresent) return null
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden',
        sidebarCompactMode ? 'w-full' : 'w-[min(28rem,calc(100%_-_2.5rem))]',
      )}
    >
      <div
        data-open={terminalDrawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${terminalDrawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <TerminalPanel
          projectId={composerProjectId}
          sessionPath={terminalSessionPath}
          onClose={controller.handleCloseTerminalDrawer}
          hoverToFocus={controller.shellState?.appSettings.hoverToFocus ?? true}
          hoverToBlur={controller.shellState?.appSettings.hoverToBlur ?? false}
        />
      </div>
    </div>
  )
}

function AppShellToast(props: AppShellLayoutViewProps) {
  const { controller } = props
  if (!controller.toast) return null
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 backdrop-blur-sm',
        appTypeGroupTextClass,
        appToneTextClass,
      )}
    >
      {controller.toast}
    </div>
  )
}

function MacWindowDragZones() {
  return (
    <div className="mac-window-drag-zones" aria-hidden="true">
      <div className="mac-window-drag-zone mac-window-drag-zone--titlebar" />
    </div>
  )
}

export function AppShellLayoutView(props: AppShellLayoutViewProps) {
  return (
    <>
      <div className={appShellRootClass}>
        <MacWindowDragZones />
        <DesktopSidebarFrame {...props} />
        <CompactSidebarOverlay {...props} />
        <CompactSidebarPanel {...props} />
        <AppShellWorkspaceSection {...props} />
      </div>
      <AppShellToast {...props} />
    </>
  )
}
