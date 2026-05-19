import { PanelLeftOpen, PanelRightClose } from 'lucide-react'
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from 'react'
import { Sidebar } from '../components/sidebar/sidebar'
import { TerminalPanel } from '../components/workspace/terminal-panel'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { cn } from '../utils/cn'
import { AppShellOverlays } from './app-shell-overlays'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'

const TERMINAL_DRAWER_WIDTH = 'min(28rem, calc(100% - 2.5rem))'
type AppShellLayoutViewProps = {
  controller: AppShellController
  projects: AppShellController['projects']
  state: AppShellController['state']
  projectScopeLockActive: boolean
  effectiveCollapsedProjectIds: Record<string, boolean>
  handleAction: AppShellController['handleAction']
  handleShowView: AppShellController['handleShowView']
  handleToggleSettings: AppShellController['handleToggleSettings']
  handleProjectSelect: AppShellController['handleProjectSelect']
  handleSetSelectedProject: AppShellController['handleSetSelectedProject']
  handleProjectReorder: AppShellController['handleProjectReorder']
  handleThreadOpen: AppShellController['handleThreadOpen']
  handleToggleProjectCollapse: AppShellController['handleToggleProjectCollapse']
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  sidebarOverlayOpen: boolean
  setSidebarOverlayOpen: Dispatch<SetStateAction<boolean>>
  utilityViewActive: boolean
  handleToggleSidebar: () => void
  compactSidebarButtonEdgeMode: boolean
  artifactDrawerOverlayVisible: boolean
  closeArtifactDrawerOverlay: (() => void) | null
  mainSectionRef: RefObject<HTMLElement | null>
  takeoverVisible: boolean
  activeComposerState: AppShellController['activeComposerState']
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
  handleArtifactDrawerOverlayChange: (visible: boolean, onClose?: (() => void) | undefined) => void
  takeoverPresent: boolean
  takeoverTerminalKey: string
  handleOpenGitOpsFromTakeover: () => Promise<void>
  terminalDrawerPresent: boolean
  compactMode?: boolean
  onCloseCompactSidebar?: () => void
}

const FALLBACK_APP_SETTINGS = {
  chatModel: null,
  chatThinkingLevel: null,
  codeModel: null,
  codeThinkingLevel: null,
  gitCommitMessageModel: null,
  gitCommitMessageThinkingLevel: 'off',
  skillCreatorModel: null,
  skillCreatorThinkingLevel: 'off',
  composerStreamingBehavior: 'followUp',
  dictationModelId: null,
  dictationMaxDurationSeconds: 180,
  showDictationButton: true,
  favoriteFolders: [],
  projectImportState: null,
  preferredProjectLocation: null,
  initializeGitOnProjectCreate: false,
  projectDashboardEnabled: true,
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'head' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  howcodeNativeAskQuestions: false,
  devUpdateBranch: false,
  piTuiTakeover: false,
  hoverToFocus: true,
  hoverToBlur: false,
  keybindings: {},
  composerSendMode: 'enter',
} satisfies AppSettings

function noopCloseCompactSidebar() {
  // Optional compact-sidebar close handler is absent for the desktop sidebar.
}

function AppShellSidebar(props: AppShellLayoutViewProps) {
  const {
    controller,
    projects,
    state,
    projectScopeLockActive,
    effectiveCollapsedProjectIds,
    handleAction,
    handleShowView,
    handleToggleSettings,
    handleProjectSelect,
    handleSetSelectedProject,
    handleProjectReorder,
    handleThreadOpen,
    handleToggleProjectCollapse,
    compactMode,
    onCloseCompactSidebar,
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
      chatSidebarState={controller.chatSidebarState}
      activeView={state.activeView}
      protectedProjectId={controller.shellState?.resolvedCwd ?? controller.shellState?.cwd ?? null}
      selectedInboxSessionPath={state.selectedInboxSessionPath}
      selectedProjectId={state.selectedProjectId}
      selectedThreadId={state.selectedThreadId}
      selectedChatGroupId={controller.selectedChatGroupId}
      settingsOpen={state.settingsOpen}
      projectScopeLockActive={projectScopeLockActive}
      terminalRunningProjectIds={controller.terminalRunningProjectIds}
      terminalRunningSessionPaths={controller.terminalRunningSessionPaths}
      collapsedProjectIds={effectiveCollapsedProjectIds}
      onAction={handleAction}
      onShowView={handleShowView}
      onToggleSettings={handleToggleSettings}
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
      onProjectReorder={handleProjectReorder}
      onLoadProjectThreads={controller.handleLoadProjectThreads}
      onSelectInboxThread={controller.handleSelectInboxThread}
      onThreadOpen={handleThreadOpen}
      onToggleProjectCollapse={handleToggleProjectCollapse}
      compactMode={compactMode ?? false}
      onCloseCompactSidebar={onCloseCompactSidebar ?? noopCloseCompactSidebar}
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
      {hidden ? null : <AppShellSidebar {...props} compactMode={false} />}
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

function CompactUtilitySidebarButton(props: AppShellLayoutViewProps) {
  const { sidebarCompactMode, sidebarOverlayOpen, utilityViewActive, handleToggleSidebar } = props
  if (!(sidebarCompactMode && !sidebarOverlayOpen && utilityViewActive)) return null
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-[45]">
      <button
        type="button"
        className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--panel)] text-[color:var(--muted)] opacity-70 shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
        onClick={handleToggleSidebar}
        aria-label="Show sidebar"
        data-tooltip="Show sidebar"
        data-tooltip-placement="right"
      >
        <PanelLeftOpen size={15} />
      </button>
    </div>
  )
}

function CompactWorkspaceSidebarButton(props: AppShellLayoutViewProps) {
  const {
    sidebarCompactMode,
    sidebarOverlayOpen,
    utilityViewActive,
    compactSidebarButtonEdgeMode,
    artifactDrawerOverlayVisible,
    closeArtifactDrawerOverlay,
    handleToggleSidebar,
  } = props
  if (!(sidebarCompactMode && !sidebarOverlayOpen && !utilityViewActive) || props.takeoverVisible)
    return null
  if (
    (props.state.activeView === 'code' || props.state.activeView === 'project') &&
    props.state.selectedProjectId
  ) {
    return null
  }
  const closeVisible = artifactDrawerOverlayVisible && closeArtifactDrawerOverlay
  const workspaceDockStyle = {
    '--dock-left-lane': 'max(2rem, calc((100cqw - 800px - 1rem) / 2))',
  } as CSSProperties
  const sidebarButtonStyle = compactSidebarButtonEdgeMode
    ? undefined
    : ({
        transform: 'translateX(clamp(2rem, calc(8rem - var(--dock-left-lane)), 2.5rem))',
      } as CSSProperties)
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-[45] pb-4',
        compactSidebarButtonEdgeMode ? 'px-3' : 'px-5',
      )}
    >
      <div
        className="grid w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] items-end gap-2 [container-type:inline-size]"
        style={workspaceDockStyle}
      >
        <div
          className={cn(
            'pointer-events-auto mb-1.5 min-w-0 self-end transition-transform duration-100 ease-out',
            compactSidebarButtonEdgeMode ? 'justify-self-start' : 'justify-self-end',
          )}
          style={sidebarButtonStyle}
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--panel)] text-[color:var(--muted)] shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
              !artifactDrawerOverlayVisible && 'opacity-70 hover:opacity-100',
            )}
            onClick={handleToggleSidebar}
            aria-label="Show sidebar"
            data-tooltip="Show sidebar"
            data-tooltip-placement="right"
          >
            <PanelLeftOpen
              size={15}
              className={cn(
                artifactDrawerOverlayVisible &&
                  '[&_*]:fill-[color:var(--workspace)] [&_*]:stroke-[color:var(--muted)]',
              )}
            />
          </button>
        </div>
        <div
          className={cn(
            'pointer-events-none col-start-3 mb-1.5 min-w-0 justify-self-end self-end transition-opacity duration-150 ease-out',
            closeVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
              closeVisible ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            onClick={() => closeArtifactDrawerOverlay?.()}
            aria-label="Hide artifacts"
            data-tooltip="Hide artifacts"
            data-tooltip-placement="left"
            tabIndex={closeVisible ? 0 : -1}
          >
            <PanelRightClose
              size={15}
              className="[&_*]:fill-[color:var(--workspace)] [&_*]:stroke-[color:var(--muted)]"
            />
          </button>
        </div>
      </div>
    </div>
  )
}

function CompactSidebarPanel(props: AppShellLayoutViewProps) {
  const { sidebarCompactMode, sidebarOverlayOpen, setSidebarOverlayOpen } = props
  if (!sidebarCompactMode) return null
  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${sidebarOverlayOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
    >
      <AppShellSidebar
        {...props}
        compactMode
        onCloseCompactSidebar={() => setSidebarOverlayOpen(false)}
      />
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
    handleArtifactDrawerOverlayChange,
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
            onArtifactDrawerOverlayChange={handleArtifactDrawerOverlayChange}
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
          workspaceContentClass={workspaceContentClass}
          onToggleSidebar={handleToggleSidebar}
          onOpenGitOps={handleOpenGitOpsFromTakeover}
          onSetDiffBaseline={handleSetDiffBaseline}
          hoverToFocus={controller.shellState?.appSettings.hoverToFocus ?? true}
          hoverToBlur={controller.shellState?.appSettings.hoverToBlur ?? false}
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
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden"
      style={{ width: sidebarCompactMode ? '100%' : TERMINAL_DRAWER_WIDTH }}
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
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 text-[13px] text-[color:var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      {controller.toast}
    </div>
  )
}

export function AppShellLayoutView(props: AppShellLayoutViewProps) {
  return (
    <>
      <div className={appShellRootClass}>
        <DesktopSidebarFrame {...props} />
        <CompactSidebarOverlay {...props} />
        <CompactUtilitySidebarButton {...props} />
        <CompactWorkspaceSidebarButton {...props} />
        <CompactSidebarPanel {...props} />
        <AppShellWorkspaceSection {...props} />
      </div>
      <AppShellToast {...props} />
    </>
  )
}
