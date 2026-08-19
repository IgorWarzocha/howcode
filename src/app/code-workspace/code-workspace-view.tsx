import { useCallback, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../app-shell/keybinding-events'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { Message } from '../types'
import type { CodeWorkspaceViewProps } from './code-workspace-contract'
import { CodeWorkspaceViewContent } from './code-workspace-footer'
import { useGitOpsReviewController } from './useGitOpsReviewController'
import { useQueuedPromptRestore } from './useQueuedPromptRestore'
import { useWorkspaceFooterHeight } from './useWorkspaceFooterHeight'

const TERMINAL_DRAWER_OFFSET = 'min(28rem, calc(100% - 2.5rem))'
const EMPTY_COMPOSER_TOP = '60%'

function shouldShowDesktopTerminalDrawer(
  activeView: AppShellController['workspace']['state']['activeView'],
  terminalDrawerVisible: boolean,
  terminalDrawerOverlay: boolean,
) {
  return (
    (activeView === 'thread' || activeView === 'project') &&
    terminalDrawerVisible &&
    !terminalDrawerOverlay
  )
}

function getFloatingFooterStyle(input: {
  centerDashboardFooter: boolean
  centerThreadFooter: boolean
  showThreadFooter: boolean
  terminalDrawerInsetStyle: { right: string } | undefined
}) {
  if (input.centerDashboardFooter) {
    return { ...input.terminalDrawerInsetStyle, top: EMPTY_COMPOSER_TOP }
  }

  if (!input.showThreadFooter) {
    return input.terminalDrawerInsetStyle
  }

  return input.centerThreadFooter
    ? { ...input.terminalDrawerInsetStyle, top: EMPTY_COMPOSER_TOP }
    : { ...input.terminalDrawerInsetStyle, bottom: 0 }
}

function getFloatingFooterLayoutState(input: {
  activeView: AppShellController['workspace']['state']['activeView']
  activeThreadData: Message[] | undefined
  activeThreadLoading: boolean
  showThreadFooter: boolean
}) {
  const hasThreadConversation = input.showThreadFooter && (input.activeThreadData?.length ?? 0) > 0
  const hasThreadConversationLayout = hasThreadConversation || input.activeThreadLoading
  const centerDashboardFooter = false
  const centerThreadFooter = input.showThreadFooter && !hasThreadConversationLayout
  return {
    centerDashboardFooter,
    centerThreadFooter,
    floatingWorkspaceFooter: centerThreadFooter || centerDashboardFooter,
  }
}

function getCodeWorkspaceFlags(input: {
  activeView: AppShellController['workspace']['state']['activeView']
  hasSelectedProject: boolean
  selectedProjectId: string
}) {
  const selectedProjectIdForView =
    input.activeView === 'project' && input.hasSelectedProject ? input.selectedProjectId : ''
  return {
    showWorkspaceFooter: input.activeView === 'thread' || input.activeView === 'gitops',
    showThreadFooter: input.activeView === 'thread',
    showCodeSidebarFooter:
      (input.activeView === 'code' || input.activeView === 'landing') && !selectedProjectIdForView,
    showDiffInMainView: input.activeView === 'gitops',
  }
}

export function CodeWorkspaceView({
  controller,
  activeComposerState,
  activePiExtensionUiState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: CodeWorkspaceViewProps) {
  const [gitOpsFileTreeVisibilityByThread, setGitOpsFileTreeVisibilityByThread] = useState<
    Record<string, boolean>
  >({})
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const handleAction = controller.desktop.handleAction
  const handleLoadEarlierMessages = controller.thread.loadEarlierMessages
  const handleCloseGitOpsView = controller.gitOps.close
  const handleOpenGitOpsView = controller.gitOps.open
  const handleOpenWorktreeDiffFile = controller.gitOps.openWorktreeFile
  const handleShowTakeoverTerminal = controller.takeover.show
  const handleToggleTerminal = controller.terminal.toggle
  const listComposerAttachmentEntries = controller.composer.listAttachmentEntries
  const projectGitState = controller.projects.gitState
  const { shellState } = controller.desktop
  const { state } = controller.workspace
  const { showWorkspaceFooter, showThreadFooter, showCodeSidebarFooter, showDiffInMainView } =
    getCodeWorkspaceFlags({
      activeView: state.activeView,
      hasSelectedProject: state.hasSelectedProject,
      selectedProjectId: state.selectedProjectId,
    })
  const showDesktopTerminalDrawer = shouldShowDesktopTerminalDrawer(
    state.activeView,
    terminalDrawerVisible,
    terminalDrawerOverlay,
  )
  const gitOpsFileTreeStateKey = `${composerProjectId}:${terminalSessionPath ?? 'project'}`
  const gitOpsFileTreeVisible =
    gitOpsFileTreeVisibilityByThread[gitOpsFileTreeStateKey] ??
    shellState?.appSettings.gitDiffFileTreeDefaultVisible ??
    true
  const [includeUntrackedDiffFilesByThread, setIncludeUntrackedDiffFilesByThread] = useState<
    Record<string, boolean>
  >({})
  const gitDiffIncludeUntrackedDefault =
    shellState?.appSettings.gitDiffIncludeUntrackedDefault ?? false
  const parentBranchName =
    shellState?.projects.find((project) => project.id === composerProjectId)?.worktree
      ?.parentBranchName ?? null
  const includeUntrackedDiffFiles =
    includeUntrackedDiffFilesByThread[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
  const toggleGitOpsFileTree = useCallback(() => {
    setGitOpsFileTreeVisibilityByThread((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }))
  }, [gitOpsFileTreeStateKey, gitOpsFileTreeVisible])
  const toggleIncludeUntrackedDiffFiles = useCallback(() => {
    setIncludeUntrackedDiffFilesByThread((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(
        current[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
      ),
    }))
  }, [gitDiffIncludeUntrackedDefault, gitOpsFileTreeStateKey])
  useHowcodeKeybindingCommand('gitops.toggleChangedFiles', (event) => {
    if (state.activeView !== 'gitops') return
    event.preventDefault()
    toggleGitOpsFileTree()
  })
  const [diffLoadError, setDiffLoadError] = useState<string | null>(null)
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  })
  const { centerDashboardFooter, centerThreadFooter, floatingWorkspaceFooter } =
    getFloatingFooterLayoutState({
      activeThreadData: activeThreadData?.messages,
      activeThreadLoading: controller.thread.activeLoading,
      activeView: state.activeView,
      showThreadFooter,
    })
  const footerInset = showWorkspaceFooter && !floatingWorkspaceFooter ? footerHeight : 0
  const gitOpsReview = useGitOpsReviewController({
    baseline: diffBaseline,
    composerProjectId,
    handleAction,
    handleOpenWorktreeDiffFile,
    shellState,
    includeUntracked: includeUntrackedDiffFiles,
  })
  const {
    handleEditQueuedPrompt,
    handleRemoveQueuedPrompt,
    markRestoredQueuedPromptApplied,
    pendingQueuedPromptIdsForSession,
    scopedRestoredQueuedPrompt,
  } = useQueuedPromptRestore({
    composerProjectId,
    handleAction,
    terminalSessionPath,
  })

  const terminalDrawerInsetStyle = showDesktopTerminalDrawer
    ? { right: TERMINAL_DRAWER_OFFSET }
    : undefined
  const threadFooterStyle = getFloatingFooterStyle({
    centerDashboardFooter,
    centerThreadFooter,
    showThreadFooter,
    terminalDrawerInsetStyle,
  })
  const threadTimelineLoading = state.activeView === 'thread' && controller.thread.activeLoading

  return (
    <CodeWorkspaceViewContent
      terminalDrawerInsetStyle={terminalDrawerInsetStyle}
      terminalDrawerVisible={terminalDrawerVisible}
      footerInset={footerInset}
      mainViewRef={mainViewRef}
      state={state}
      showDiffInMainView={showDiffInMainView}
      composerProjectId={composerProjectId}
      projectGitState={projectGitState}
      parentBranchName={parentBranchName}
      diffBaseline={diffBaseline}
      gitOpsReview={gitOpsReview}
      diffRenderMode={diffRenderMode}
      gitOpsFileTreeVisible={gitOpsFileTreeVisible}
      includeUntrackedDiffFiles={includeUntrackedDiffFiles}
      controller={controller}
      shellState={shellState}
      activeComposerState={activeComposerState}
      activePiExtensionUiState={activePiExtensionUiState}
      currentProjectName={currentProjectName}
      workspaceContentClass={workspaceContentClass}
      activeThreadData={activeThreadData}
      threadTimelineLoading={threadTimelineLoading}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      handleAction={handleAction}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      sidebarCollapsed={sidebarCollapsed}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
      handleLoadEarlierMessages={handleLoadEarlierMessages}
      showWorkspaceFooter={showWorkspaceFooter}
      footerRef={footerRef}
      showThreadFooter={showThreadFooter}
      centerThreadFooter={centerThreadFooter}
      threadFooterStyle={threadFooterStyle}
      sidebarAutoHidden={sidebarAutoHidden}
      terminalSessionPath={terminalSessionPath}
      diffLoadError={diffLoadError}
      setDiffLoadError={setDiffLoadError}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      setComposerLayoutVersion={setComposerLayoutVersion}
      handleCloseGitOpsView={handleCloseGitOpsView}
      handleEditQueuedPrompt={handleEditQueuedPrompt}
      handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
      pendingQueuedPromptIdsForSession={pendingQueuedPromptIdsForSession}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleShowTakeoverTerminal={handleShowTakeoverTerminal}
      handleOpenGitOpsView={handleOpenGitOpsView}
      markRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      handleToggleTerminal={handleToggleTerminal}
      showDesktopTerminalDrawer={showDesktopTerminalDrawer}
      toggleGitOpsFileTree={toggleGitOpsFileTree}
      toggleIncludeUntrackedDiffFiles={toggleIncludeUntrackedDiffFiles}
      showCodeSidebarFooter={showCodeSidebarFooter}
      scopedRestoredQueuedPrompt={scopedRestoredQueuedPrompt}
    />
  )
}
