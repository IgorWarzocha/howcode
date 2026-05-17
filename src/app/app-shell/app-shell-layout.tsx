import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getPersistedSessionPath, isLocalSessionPath } from '../../../shared/session-paths'
import { defaultDiffBaseline } from '../components/workspace/composer/diff-baseline'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { AppShellLayoutView } from './app-shell-layout-view'
import { useAppKeybindings } from './useAppKeybindings'
import type { AppShellController } from './useAppShellController'
import { useAppShellLayoutState } from './useAppShellLayoutState'

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
  const [sidebarCompactMode, setSidebarCompactMode] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 1236,
  )
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
  const terminalDrawerVisible =
    !sidebarCompactMode &&
    (state.activeView === 'thread' || state.activeView === 'code') &&
    state.terminalVisible
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

  useLayoutEffect(() => {
    const updateSidebarCompactMode = () => {
      const nextCompactMode = window.innerWidth <= 1236
      if (nextCompactMode && controllerRef.current.state.terminalVisible) {
        controllerRef.current.handleCloseTerminalDrawer()
      }
      setSidebarCompactMode(nextCompactMode)
    }
    updateSidebarCompactMode()
    window.addEventListener('resize', updateSidebarCompactMode)
    return () => window.removeEventListener('resize', updateSidebarCompactMode)
  }, [])

  useEffect(() => {
    if (!sidebarCompactMode) setSidebarOverlayOpen(false)
  }, [sidebarCompactMode])

  const previousSidebarCompactModeRef = useRef(sidebarCompactMode)
  useEffect(() => {
    const wasSidebarCompactMode = previousSidebarCompactModeRef.current
    previousSidebarCompactModeRef.current = sidebarCompactMode
    if (!wasSidebarCompactMode && sidebarCompactMode && terminalDrawerVisible) {
      controllerRef.current.handleCloseTerminalDrawer()
    }
  }, [sidebarCompactMode, terminalDrawerVisible])

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

  const handleOpenSidebar = useCallback(() => {
    setSidebarCollapsed(false)
    if (sidebarCompactMode) setSidebarOverlayOpen(true)
  }, [sidebarCompactMode])

  useAppKeybindings({
    controller,
    keybindings: controller.shellState?.appSettings.keybindings ?? {},
    onOpenSidebar: handleOpenSidebar,
    onToggleSidebar: handleToggleSidebar,
  })

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
