import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getPersistedSessionPath, isLocalSessionPath } from '../../../shared/session-paths'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { AppShellLayoutView } from './app-shell-layout-view'
import { useAppKeybindings } from './useAppKeybindings'
import type { AppShellController } from './useAppShellController'
import { useAppShellDiffPreferences } from './useAppShellDiffPreferences'
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
  const [terminalHiddenByCompactResize, setTerminalHiddenByCompactResize] = useState(false)
  const [artifactDrawerOverlayVisible, setArtifactDrawerOverlayVisible] = useState(false)
  const [closeArtifactDrawerOverlay, setCloseArtifactDrawerOverlay] = useState<(() => void) | null>(
    null,
  )
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
    (state.activeView === 'thread' || state.activeView === 'code') &&
    state.terminalVisible &&
    !(sidebarCompactMode && terminalHiddenByCompactResize)
  const utilityViewActive = isUtilityView(state.activeView)
  const compactSidebarButtonEdgeMode =
    state.activeView === 'code' || terminalDrawerVisible || artifactDrawerOverlayVisible
  const animatedTerminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible)
  const terminalDrawerPresent =
    sidebarCompactMode && terminalHiddenByCompactResize
      ? terminalDrawerVisible
      : animatedTerminalDrawerPresent
  const { diffBaseline, diffRenderMode, handleSetDiffBaseline, handleSetDiffRenderMode } =
    useAppShellDiffPreferences({
      activeThreadId,
      composerProjectId,
      controller,
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

  const previousWindowCompactModeRef = useRef(
    typeof window === 'undefined' ? false : window.innerWidth <= 1236,
  )
  useLayoutEffect(() => {
    const updateSidebarCompactMode = () => {
      const nextCompactMode = window.innerWidth <= 1236
      const enteredCompactMode = !previousWindowCompactModeRef.current && nextCompactMode
      previousWindowCompactModeRef.current = nextCompactMode
      if (enteredCompactMode && controllerRef.current.state.terminalVisible) {
        setTerminalHiddenByCompactResize(true)
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

  useEffect(() => {
    if (!state.terminalVisible) setTerminalHiddenByCompactResize(false)
  }, [state.terminalVisible])

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
