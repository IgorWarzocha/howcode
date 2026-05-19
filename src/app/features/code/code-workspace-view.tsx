import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import type { AppShellController } from '../../app-shell/useAppShellController'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../../desktop/types'
import { useDesktopDiff } from '../../hooks/useDesktopDiff'
import type { Message } from '../../types'
import { CodeWorkspaceViewContent } from './code-workspace-footer'
import { useDiffCommentController } from './useDiffCommentController'
import { useQueuedPromptRestore } from './useQueuedPromptRestore'
import { useWorkspaceFooterHeight } from './useWorkspaceFooterHeight'

type CodeWorkspaceViewProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

const TERMINAL_DRAWER_OFFSET = 'min(28rem, calc(100% - 2.5rem))'
const EMPTY_COMPOSER_TOP = '60%'
export type CodeWorkspaceContentProps = CodeWorkspaceViewProps &
  ReturnType<typeof useDiffCommentController> &
  ReturnType<typeof useQueuedPromptRestore> & {
    footerRef: RefObject<HTMLElement | null>
    mainViewRef: RefObject<HTMLElement | null>
    terminalDrawerInsetStyle: { right: string } | undefined
    footerInset: number
    threadFooterStyle: { right?: string; top?: string } | undefined
    showWorkspaceFooter: boolean
    showThreadFooter: boolean
    showCodeSidebarFooter: boolean
    showUtilitySidebarButton: boolean
    showDiffInMainView: boolean
    showDesktopTerminalDrawer: boolean
    centerThreadFooter: boolean
    gitOpsFileTreeVisible: boolean
    toggleGitOpsFileTree: () => void
    diffLoadError: string | null
    threadTimelineLoading: boolean
    composerLayoutVersion: number
    setComposerLayoutVersion: Dispatch<SetStateAction<number>>
    composerOverlayHeight: number
    setComposerOverlayHeight: Dispatch<SetStateAction<number>>
    composerPromptResetKey: number
    setComposerPromptResetKey: Dispatch<SetStateAction<number>>
    handleAction: AppShellController['handleAction']
    handleLoadEarlierMessages: AppShellController['handleLoadEarlierMessages']
    handleCloseGitOpsView: AppShellController['handleCloseGitOpsView']
    handleOpenGitOpsView: AppShellController['handleOpenGitOpsView']
    handleShowTakeoverTerminal: AppShellController['handleShowTakeoverTerminal']
    handleToggleTerminal: AppShellController['handleToggleTerminal']
    listComposerAttachmentEntries: AppShellController['listComposerAttachmentEntries']
    shellState: AppShellController['shellState']
    state: AppShellController['state']
    projectGitState: AppShellController['projectGitState']
  }

function isCodeUtilityView(activeView: AppShellController['state']['activeView']) {
  return (
    activeView === 'settings' ||
    activeView === 'extensions' ||
    activeView === 'skills' ||
    activeView === 'archived'
  )
}

function shouldShowDesktopTerminalDrawer(
  activeView: AppShellController['state']['activeView'],
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
  activeView: AppShellController['state']['activeView']
  activeThreadData: Message[] | undefined
  activeThreadLoading: boolean
  showThreadFooter: boolean
}) {
  const hasThreadConversation = input.showThreadFooter && (input.activeThreadData?.length ?? 0) > 0
  const hasThreadConversationLayout = hasThreadConversation || input.activeThreadLoading
  const centerDashboardFooter = input.activeView === 'project'
  const centerThreadFooter = input.showThreadFooter && !hasThreadConversationLayout
  return {
    centerDashboardFooter,
    centerThreadFooter,
    floatingWorkspaceFooter: centerThreadFooter || centerDashboardFooter,
  }
}

function getCodeWorkspaceFlags(input: {
  activeView: AppShellController['state']['activeView']
  hasSelectedProject: boolean
  selectedProjectId: string
}) {
  const selectedProjectIdForView =
    input.activeView === 'project' && input.hasSelectedProject ? input.selectedProjectId : ''
  return {
    showWorkspaceFooter:
      input.activeView === 'thread' ||
      input.activeView === 'gitops' ||
      input.activeView === 'project',
    showThreadFooter: input.activeView === 'thread',
    showCodeSidebarFooter:
      (input.activeView === 'code' || input.activeView === 'landing') && !selectedProjectIdForView,
    showUtilitySidebarButton: isCodeUtilityView(input.activeView),
    showDiffInMainView: input.activeView === 'gitops',
  }
}

export function CodeWorkspaceView({
  controller,
  activeComposerState,
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
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0)
  const [gitOpsFileTreeVisibilityByThread, setGitOpsFileTreeVisibilityByThread] = useState<
    Record<string, boolean>
  >({})
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleCloseGitOpsView,
    handleOpenGitOpsView,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    projectGitState,
    shellState,
    state,
  } = controller
  const {
    showWorkspaceFooter,
    showThreadFooter,
    showCodeSidebarFooter,
    showUtilitySidebarButton,
    showDiffInMainView,
  } = getCodeWorkspaceFlags({
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
  const toggleGitOpsFileTree = useCallback(() => {
    setGitOpsFileTreeVisibilityByThread((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }))
  }, [gitOpsFileTreeStateKey, gitOpsFileTreeVisible])
  useHowcodeKeybindingCommand('gitops.toggleChangedFiles', (event) => {
    if (state.activeView !== 'gitops') return
    event.preventDefault()
    toggleGitOpsFileTree()
  })
  const { error: diffLoadError } = useDesktopDiff(
    composerProjectId,
    diffBaseline,
    showDiffInMainView && (projectGitState?.isGitRepo ?? false),
  )
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  })
  const { centerDashboardFooter, centerThreadFooter, floatingWorkspaceFooter } =
    getFloatingFooterLayoutState({
      activeThreadData: activeThreadData?.messages,
      activeThreadLoading: controller.activeThreadLoading,
      activeView: state.activeView,
      showThreadFooter,
    })
  const footerInset = showWorkspaceFooter && !floatingWorkspaceFooter ? footerHeight : 0
  const {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  } = useDiffCommentController({
    composerProjectId,
    handleAction,
    handleOpenWorktreeDiffFile,
    setComposerPromptResetKey,
    shellState,
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
  const threadTimelineLoading = state.activeView === 'thread' && controller.activeThreadLoading

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
      diffBaseline={diffBaseline}
      selectedDiffCommentId={selectedDiffCommentId}
      selectedDiffCommentJumpKey={selectedDiffCommentJumpKey}
      diffRenderMode={diffRenderMode}
      gitOpsFileTreeVisible={gitOpsFileTreeVisible}
      controller={controller}
      shellState={shellState}
      activeComposerState={activeComposerState}
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
      diffComments={diffComments}
      diffCommentCount={diffCommentCount}
      diffCommentsSending={diffCommentsSending}
      diffCommentError={diffCommentError}
      diffLoadError={diffLoadError}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      handleSendDiffComments={handleSendDiffComments}
      handleSelectDiffComment={handleSelectDiffComment}
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
      showCodeSidebarFooter={showCodeSidebarFooter}
      showUtilitySidebarButton={showUtilitySidebarButton}
      scopedRestoredQueuedPrompt={scopedRestoredQueuedPrompt}
      composerPromptResetKey={composerPromptResetKey}
      setComposerPromptResetKey={setComposerPromptResetKey}
    />
  )
}
