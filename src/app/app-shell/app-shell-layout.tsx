import { PanelLeftOpen, PanelRightClose } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getPersistedSessionPath, isLocalSessionPath } from '../../../shared/session-paths'
import { Sidebar } from '../components/sidebar/sidebar'
import { defaultDiffBaseline } from '../components/workspace/composer/diff-baseline'
import { TerminalPanel } from '../components/workspace/terminal-panel'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { cn } from '../utils/cn'
import { AppShellOverlays } from './app-shell-overlays'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'
import { useAppShellLayoutState } from './useAppShellLayoutState'

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

type TakeoverTerminalKeyState = {
  key: string
  projectId: string
  threadId: string | null
  sessionPath: string | null
}

function isLocalToPersistedTakeoverTransition(
  previous: TakeoverTerminalKeyState,
  nextProjectId: string,
  nextThreadId: string | null,
  nextSessionPath: string | null,
) {
  return (
    previous.projectId === nextProjectId &&
    previous.threadId !== null &&
    previous.threadId === nextThreadId &&
    isLocalSessionPath(previous.sessionPath) &&
    getPersistedSessionPath(nextSessionPath) !== null
  )
}

function areDiffBaselinesEqual(left: ProjectDiffBaseline, right: ProjectDiffBaseline) {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'commit' && right.kind === 'commit') {
    return left.sha === right.sha
  }

  if (left.kind === 'last-opened' && right.kind === 'last-opened') {
    return left.rev === right.rev
  }

  return true
}

function isSameDraftPromotion({
  activeThreadId,
  messageCount,
  previousSessionPath,
  previousThreadId,
  nextSessionPath,
}: {
  activeThreadId: string | null
  messageCount: number | null
  previousSessionPath: string | null
  previousThreadId: string | null
  nextSessionPath: string | null
}) {
  return (
    isLocalSessionPath(previousSessionPath) &&
    previousThreadId?.startsWith('local-thread-') &&
    activeThreadId !== null &&
    getPersistedSessionPath(nextSessionPath) !== null &&
    (messageCount === null || messageCount <= 1)
  )
}

type DiffBaselineState = {
  projectId: string
  threadId: string | null
  sessionPath: string | null
  baseline: ProjectDiffBaseline
  source: 'init' | 'override' | 'default'
}

function getThreadSessionPath(state: AppShellController['state']) {
  if (state.activeView === 'chat' || state.activeView === 'thread' || state.activeView === 'gitops')
    return state.selectedSessionPath
  return null
}

function getThreadId(state: AppShellController['state']) {
  if (state.activeView === 'chat' || state.activeView === 'thread' || state.activeView === 'gitops')
    return state.selectedThreadId
  return null
}

function isUtilityView(activeView: AppShellController['state']['activeView']) {
  return (
    activeView === 'settings' ||
    activeView === 'extensions' ||
    activeView === 'skills' ||
    activeView === 'archived'
  )
}

function getNextDiffBaseline(controller: AppShellController) {
  return (
    controller.activeThreadData?.diffPreferences?.baseline ??
    controller.shellState?.appSettings.gitDiffBaselineDefault ??
    defaultDiffBaseline
  )
}

function promoteDiffBaselineDraft(options: {
  activeThreadId: string | null
  composerProjectId: string
  controllerRef: React.RefObject<AppShellController>
  current: DiffBaselineState
  terminalSessionPath: string | null
}) {
  const appDefault = options.controllerRef.current.shellState?.appSettings.gitDiffBaselineDefault
  const promotedBaseline =
    appDefault && areDiffBaselinesEqual(options.current.baseline, appDefault)
      ? null
      : options.current.baseline
  void options.controllerRef.current.handleAction('workspace.diff-preferences', {
    diffBaseline: promotedBaseline,
  })
  return {
    ...options.current,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
  }
}

function nextDiffBaselineState(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  controllerRef: React.RefObject<AppShellController>
  current: DiffBaselineState
  terminalSessionPath: string | null
}) {
  const nextBaseline = getNextDiffBaseline(options.controller)
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeThreadId: options.activeThreadId,
      messageCount: options.controller.activeThreadData?.messages.length ?? null,
      previousSessionPath: options.current.sessionPath,
      previousThreadId: options.current.threadId,
      nextSessionPath: options.terminalSessionPath,
    })
  )
    return promoteDiffBaselineDraft(options)
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.threadId === options.activeThreadId &&
    options.current.sessionPath === options.terminalSessionPath &&
    (options.current.source === 'override' ||
      areDiffBaselinesEqual(options.current.baseline, nextBaseline))
  )
    return options.current
  return {
    projectId: options.composerProjectId,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
    baseline: nextBaseline,
    source: 'init' as const,
  }
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
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'head' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  howcodeNativeAskQuestions: false,
  piTuiTakeover: false,
  hoverToFocus: true,
  hoverToBlur: false,
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
      onOpenSkillsView={() => handleShowView('skills')}
      onOpenSettingsPanel={() => handleShowView('settings')}
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
  if (!(sidebarCompactMode && !sidebarOverlayOpen && !utilityViewActive)) return null
  const closeVisible = artifactDrawerOverlayVisible && closeArtifactDrawerOverlay
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-[45] pb-4',
        compactSidebarButtonEdgeMode ? 'px-3' : 'px-5',
      )}
    >
      <div className="grid w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] items-end gap-2">
        <div
          className={cn(
            'pointer-events-auto mb-1.5 min-w-0 justify-self-end self-end',
            compactSidebarButtonEdgeMode ? 'justify-self-start' : 'translate-x-10',
          )}
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
          workspaceContentClass={workspaceContentClass}
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

function AppShellLayoutView(props: AppShellLayoutViewProps) {
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

type DiffRenderModeState = {
  projectId: string
  threadId: string | null
  sessionPath: string | null
  renderMode: ProjectDiffRenderMode
  source: 'init' | 'override' | 'default'
}

function getNextDiffRenderMode(controller: AppShellController) {
  return (
    controller.activeThreadData?.diffPreferences?.renderMode ??
    controller.shellState?.appSettings.gitDiffRenderModeDefault ??
    'stacked'
  )
}

function promoteDiffRenderModeDraft(options: {
  activeThreadId: string | null
  controllerRef: React.RefObject<AppShellController>
  current: DiffRenderModeState
  terminalSessionPath: string | null
}) {
  const appDefault = options.controllerRef.current.shellState?.appSettings.gitDiffRenderModeDefault
  const promotedRenderMode =
    appDefault === options.current.renderMode ? null : options.current.renderMode
  void options.controllerRef.current.handleAction('workspace.diff-preferences', {
    diffRenderMode: promotedRenderMode,
  })
  return {
    ...options.current,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
  }
}

function nextDiffRenderModeState(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  controllerRef: React.RefObject<AppShellController>
  current: DiffRenderModeState
  terminalSessionPath: string | null
}) {
  const nextRenderMode = getNextDiffRenderMode(options.controller)
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.source === 'override' &&
    isSameDraftPromotion({
      activeThreadId: options.activeThreadId,
      messageCount: options.controller.activeThreadData?.messages.length ?? null,
      previousSessionPath: options.current.sessionPath,
      previousThreadId: options.current.threadId,
      nextSessionPath: options.terminalSessionPath,
    })
  )
    return promoteDiffRenderModeDraft(options)
  if (
    options.current.projectId === options.composerProjectId &&
    options.current.threadId === options.activeThreadId &&
    options.current.sessionPath === options.terminalSessionPath &&
    (options.current.source === 'override' || options.current.renderMode === nextRenderMode)
  )
    return options.current
  return {
    projectId: options.composerProjectId,
    threadId: options.activeThreadId,
    sessionPath: options.terminalSessionPath,
    renderMode: nextRenderMode,
    source: 'init' as const,
  }
}

function updateTakeoverTerminalKey(options: {
  composerProjectId: string
  nextTakeoverTerminalKey: string
  nextTakeoverTerminalKeyState: TakeoverTerminalKeyState
  state: AppShellController['state']
  takeoverPresent: boolean
  takeoverTerminalKeyRef: React.RefObject<TakeoverTerminalKeyState | null>
  takeoverVisible: boolean
  terminalSessionPath: string | null
}) {
  const current = options.takeoverTerminalKeyRef.current
  if (options.takeoverVisible && current === null)
    options.takeoverTerminalKeyRef.current = options.nextTakeoverTerminalKeyState
  else if (
    options.takeoverVisible &&
    current !== null &&
    current.key !== options.nextTakeoverTerminalKey &&
    !isLocalToPersistedTakeoverTransition(
      current,
      options.composerProjectId,
      options.state.selectedThreadId,
      options.terminalSessionPath,
    )
  )
    options.takeoverTerminalKeyRef.current = options.nextTakeoverTerminalKeyState
  else if (!(options.takeoverVisible || options.takeoverPresent))
    options.takeoverTerminalKeyRef.current = null
}

function getEffectiveDiffBaseline(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  diffBaselineState: DiffBaselineState
  terminalSessionPath: string | null
}) {
  if (
    options.diffBaselineState.projectId === options.composerProjectId &&
    options.diffBaselineState.threadId === options.activeThreadId &&
    options.diffBaselineState.sessionPath === options.terminalSessionPath
  )
    return options.diffBaselineState.baseline
  return getNextDiffBaseline(options.controller)
}

function getEffectiveDiffRenderMode(options: {
  activeThreadId: string | null
  composerProjectId: string
  controller: AppShellController
  diffRenderModeState: DiffRenderModeState
  terminalSessionPath: string | null
}) {
  if (
    options.diffRenderModeState.projectId === options.composerProjectId &&
    options.diffRenderModeState.threadId === options.activeThreadId &&
    options.diffRenderModeState.sessionPath === options.terminalSessionPath
  )
    return options.diffRenderModeState.renderMode
  return getNextDiffRenderMode(options.controller)
}

type AppShellLayoutProps = {
  controller: AppShellController
}

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const controllerRef = useRef(controller)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarCompactMode, setSidebarCompactMode] = useState(false)
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false)
  const [artifactDrawerOverlayVisible, setArtifactDrawerOverlayVisible] = useState(false)
  const [closeArtifactDrawerOverlay, setCloseArtifactDrawerOverlay] = useState<(() => void) | null>(
    null,
  )
  const [diffBaselineState, setDiffBaselineState] = useState<DiffBaselineState>({
    projectId: '',
    threadId: null,
    sessionPath: null,
    baseline: defaultDiffBaseline,
    source: 'init',
  })
  const [diffRenderModeState, setDiffRenderModeState] = useState<DiffRenderModeState>({
    projectId: '',
    threadId: null,
    sessionPath: null,
    renderMode: 'stacked',
    source: 'init',
  })
  const {
    activeComposerState,
    activeThreadData,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    handleAction,
    handleProjectReorder,
    handleProjectSelect,
    handleSetSelectedProject,
    handleShowView,
    handleThreadOpen,
    handleToggleProjectCollapse,
    handleToggleSettings,
    projects,
    extensionsProjectScopeActive,
    skillsProjectScopeActive,
    state,
  } = controller
  const projectScopeLockActive = extensionsProjectScopeActive || skillsProjectScopeActive
  const effectiveCollapsedProjectIds = projectScopeLockActive
    ? Object.fromEntries(projects.map((project) => [project.id, true]))
    : collapsedProjectIds

  const terminalSessionPath = getThreadSessionPath(state)
  const activeThreadId = getThreadId(state)
  const takeoverVisible = state.takeoverVisible
  const terminalDrawerVisible = state.activeView === 'thread' && state.terminalVisible
  const utilityViewActive = isUtilityView(state.activeView)
  const compactSidebarButtonEdgeMode =
    state.activeView === 'code' || terminalDrawerVisible || artifactDrawerOverlayVisible
  const terminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible)
  const diffBaseline = getEffectiveDiffBaseline({
    activeThreadId,
    composerProjectId,
    controller,
    diffBaselineState,
    terminalSessionPath,
  })
  const diffRenderMode = getEffectiveDiffRenderMode({
    activeThreadId,
    composerProjectId,
    controller,
    diffRenderModeState,
    terminalSessionPath,
  })
  const { mainSectionRef, takeoverPresent, workspaceContentClass } = useAppShellLayoutState({
    takeoverVisible,
  })
  const takeoverTerminalKeyRef = useRef<TakeoverTerminalKeyState | null>(null)
  const nextTakeoverTerminalKey = `${composerProjectId}:${
    state.selectedThreadId ?? terminalSessionPath ?? 'none'
  }`
  const nextTakeoverTerminalKeyState: TakeoverTerminalKeyState = {
    key: nextTakeoverTerminalKey,
    projectId: composerProjectId,
    threadId: state.selectedThreadId,
    sessionPath: terminalSessionPath,
  }

  updateTakeoverTerminalKey({
    composerProjectId,
    nextTakeoverTerminalKey,
    nextTakeoverTerminalKeyState,
    state,
    takeoverPresent,
    takeoverTerminalKeyRef,
    takeoverVisible,
    terminalSessionPath,
  })

  const takeoverTerminalKey = takeoverTerminalKeyRef.current?.key ?? nextTakeoverTerminalKey
  controllerRef.current = controller

  useEffect(() => {
    setDiffBaselineState((current) =>
      nextDiffBaselineState({
        activeThreadId,
        composerProjectId,
        controller,
        controllerRef,
        current,
        terminalSessionPath,
      }),
    )
  }, [activeThreadId, composerProjectId, controller, terminalSessionPath])

  useEffect(() => {
    setDiffRenderModeState((current) =>
      nextDiffRenderModeState({
        activeThreadId,
        composerProjectId,
        controller,
        controllerRef,
        current,
        terminalSessionPath,
      }),
    )
  }, [activeThreadId, composerProjectId, controller, terminalSessionPath])

  const handleSetDiffBaseline = useCallback(
    (baseline: ProjectDiffBaseline) => {
      const appDefault = controllerRef.current.shellState?.appSettings.gitDiffBaselineDefault
      const nextBaseline =
        appDefault && areDiffBaselinesEqual(baseline, appDefault) ? null : baseline
      setDiffBaselineState({
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        baseline,
        source: nextBaseline ? 'override' : 'default',
      })
      void controllerRef.current.handleAction('workspace.diff-preferences', {
        diffBaseline: nextBaseline,
      })
    },
    [activeThreadId, composerProjectId, terminalSessionPath],
  )

  const handleSetDiffRenderMode = useCallback(
    (renderMode: ProjectDiffRenderMode) => {
      const appDefault = controllerRef.current.shellState?.appSettings.gitDiffRenderModeDefault
      const nextRenderMode = appDefault === renderMode ? null : renderMode
      setDiffRenderModeState({
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        renderMode,
        source: nextRenderMode ? 'override' : 'default',
      })
      void controllerRef.current.handleAction('workspace.diff-preferences', {
        diffRenderMode: nextRenderMode,
      })
    },
    [activeThreadId, composerProjectId, terminalSessionPath],
  )

  const handleOpenGitOpsFromTakeover = useCallback(async () => {
    controllerRef.current.handleOpenGitOpsView()
    await controllerRef.current.handleCloseTakeoverTerminal({
      preserveSessionOverride: true,
      refreshThread: false,
    })
  }, [])

  const handleArtifactDrawerOverlayChange = useCallback(
    (visible: boolean, onClose?: () => void) => {
      setArtifactDrawerOverlayVisible((current) => (current === visible ? current : visible))
      setCloseArtifactDrawerOverlay((current) => {
        const next = visible && onClose ? onClose : null
        return current === next ? current : next
      })
    },
    [],
  )

  useEffect(() => {
    if (state.activeView !== 'chat') {
      setArtifactDrawerOverlayVisible(false)
      setCloseArtifactDrawerOverlay(null)
    }
  }, [state.activeView])

  useEffect(() => {
    const updateSidebarCompactMode = () => setSidebarCompactMode(window.innerWidth <= 1236)
    updateSidebarCompactMode()
    window.addEventListener('resize', updateSidebarCompactMode)
    return () => window.removeEventListener('resize', updateSidebarCompactMode)
  }, [])

  useEffect(() => {
    if (!sidebarCompactMode) setSidebarOverlayOpen(false)
  }, [sidebarCompactMode])

  useEffect(() => {
    if (!sidebarOverlayOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (controllerRef.current.state.settingsOpen) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setSidebarOverlayOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [sidebarOverlayOpen])

  const handleToggleSidebar = useCallback(() => {
    if (sidebarCompactMode) {
      setSidebarCollapsed(false)
      setSidebarOverlayOpen((open) => !open)
      return
    }
    setSidebarCollapsed((collapsed) => !collapsed)
  }, [sidebarCompactMode])

  return (
    <AppShellLayoutView
      controller={controller}
      projects={projects}
      state={state}
      projectScopeLockActive={projectScopeLockActive}
      effectiveCollapsedProjectIds={effectiveCollapsedProjectIds}
      handleAction={handleAction}
      handleShowView={handleShowView}
      handleToggleSettings={handleToggleSettings}
      handleProjectSelect={handleProjectSelect}
      handleSetSelectedProject={handleSetSelectedProject}
      handleProjectReorder={handleProjectReorder}
      handleThreadOpen={handleThreadOpen}
      handleToggleProjectCollapse={handleToggleProjectCollapse}
      sidebarCollapsed={sidebarCollapsed}
      sidebarCompactMode={sidebarCompactMode}
      sidebarOverlayOpen={sidebarOverlayOpen}
      setSidebarOverlayOpen={setSidebarOverlayOpen}
      utilityViewActive={utilityViewActive}
      handleToggleSidebar={handleToggleSidebar}
      compactSidebarButtonEdgeMode={compactSidebarButtonEdgeMode}
      artifactDrawerOverlayVisible={artifactDrawerOverlayVisible}
      closeArtifactDrawerOverlay={closeArtifactDrawerOverlay}
      mainSectionRef={mainSectionRef}
      takeoverVisible={takeoverVisible}
      activeComposerState={activeComposerState}
      activeThreadData={activeThreadData}
      composerProjectId={composerProjectId}
      currentProjectName={currentProjectName}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      terminalDrawerVisible={terminalDrawerVisible}
      terminalSessionPath={terminalSessionPath}
      workspaceContentClass={workspaceContentClass}
      handleSetDiffBaseline={handleSetDiffBaseline}
      handleSetDiffRenderMode={handleSetDiffRenderMode}
      handleArtifactDrawerOverlayChange={handleArtifactDrawerOverlayChange}
      takeoverPresent={takeoverPresent}
      takeoverTerminalKey={takeoverTerminalKey}
      handleOpenGitOpsFromTakeover={handleOpenGitOpsFromTakeover}
      terminalDrawerPresent={terminalDrawerPresent}
    />
  )
}
