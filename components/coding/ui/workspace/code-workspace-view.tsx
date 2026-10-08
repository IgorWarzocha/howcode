import { useCallback, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../../src/app/app-shell/keybinding-events'
import { useQueuedPromptCancellation } from '../../../../src/app/composer/useQueuedPromptCancellation'
import type { Message, View } from '../../../../src/app/types'
import { useWorkspaceFooterHeight } from '../../../../src/app/workspace-shell/useWorkspaceFooterHeight'
import type { CodeWorkspaceViewProps } from './code-workspace-contract'
import { CodeWorkspaceViewContent } from './code-workspace-footer'
import { useGitOpsReviewController } from './useGitOpsReviewController'
import { useCodingWorkspacePreferences } from './workspace-preferences'

const TERMINAL_DRAWER_OFFSET = 'min(28rem, calc(100% - 2.5rem))'
const EMPTY_COMPOSER_TOP = '60%'

function shouldShowDesktopTerminalDrawer(
  activeView: View,
  terminalDrawerVisible: boolean,
  terminalDrawerOverlay: boolean,
) {
  return (
    (activeView === 'chat' || activeView === 'workspace' || activeView === 'directory') &&
    terminalDrawerVisible &&
    !terminalDrawerOverlay
  )
}

function getFloatingFooterStyle(input: {
  centerDashboardFooter: boolean
  centerChatFooter: boolean
  showChatFooter: boolean
  terminalDrawerInsetStyle: { right: string } | undefined
}) {
  if (input.centerDashboardFooter) {
    return { ...input.terminalDrawerInsetStyle, top: EMPTY_COMPOSER_TOP }
  }

  if (!input.showChatFooter) {
    return input.terminalDrawerInsetStyle
  }

  return input.centerChatFooter
    ? { ...input.terminalDrawerInsetStyle, top: EMPTY_COMPOSER_TOP }
    : { ...input.terminalDrawerInsetStyle, bottom: 0 }
}

function getFloatingFooterLayoutState(input: {
  activeView: View
  activeChatData: Message[] | undefined
  activeChatLoading: boolean
  showChatFooter: boolean
}) {
  const hasChatConversation = input.showChatFooter && (input.activeChatData?.length ?? 0) > 0
  const hasChatConversationLayout = hasChatConversation || input.activeChatLoading
  const centerDashboardFooter = false
  const centerChatFooter = input.showChatFooter && !hasChatConversationLayout
  return {
    centerDashboardFooter,
    centerChatFooter,
    floatingWorkspaceFooter: centerChatFooter || centerDashboardFooter,
  }
}

function getCodeWorkspaceFlags(input: {
  activeView: View
  hasSelectedDirectory: boolean
  selectedDirectoryId: string
}) {
  const selectedDirectoryIdForView =
    (input.activeView === 'workspace' || input.activeView === 'directory') &&
    input.hasSelectedDirectory
      ? input.selectedDirectoryId
      : ''
  return {
    showWorkspaceFooter: input.activeView === 'chat' || input.activeView === 'gitops',
    showChatFooter: input.activeView === 'chat',
    showCodeSidebarFooter:
      (input.activeView === 'directories' || input.activeView === 'landing') &&
      !selectedDirectoryIdForView,
    showDiffInMainView: input.activeView === 'gitops',
  }
}

export function CodeWorkspaceView({
  controller,
  activeComposerState,
  activeChatData,
  composerDirectoryId,
  currentDirectoryName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalConversationId,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: CodeWorkspaceViewProps) {
  const {
    gitOpsFileTreeVisibilityByChat,
    setGitOpsFileTreeVisibilityByChat,
    includeUntrackedDiffFilesByChat,
    setIncludeUntrackedDiffFilesByChat,
  } = useCodingWorkspacePreferences()
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const handleAction = controller.desktop.handleAction
  const handleLoadEarlierMessages = controller.chat.loadEarlierMessages
  const handleCloseGitOpsView = controller.gitOps.close
  const handleOpenGitOpsView = controller.gitOps.open
  const handleOpenWorktreeDiffFile = controller.gitOps.openWorktreeFile
  const handleToggleTerminal = controller.terminal.toggle
  const listComposerAttachmentEntries = controller.composer.listAttachmentEntries
  const directoryGitState = controller.directories.gitState
  const { shellState } = controller.desktop
  const { state } = controller.workspace
  const { showWorkspaceFooter, showChatFooter, showCodeSidebarFooter, showDiffInMainView } =
    getCodeWorkspaceFlags({
      activeView: state.activeView,
      hasSelectedDirectory: state.hasSelectedDirectory,
      selectedDirectoryId: state.selectedDirectoryId,
    })
  const showDesktopTerminalDrawer = shouldShowDesktopTerminalDrawer(
    state.activeView,
    terminalDrawerVisible,
    terminalDrawerOverlay,
  )
  const gitOpsFileTreeStateKey = `${composerDirectoryId}:${terminalConversationId ?? 'workspace'}`
  const gitOpsFileTreeVisible =
    gitOpsFileTreeVisibilityByChat[gitOpsFileTreeStateKey] ??
    shellState?.appSettings.gitDiffFileTreeDefaultVisible ??
    true

  const gitDiffIncludeUntrackedDefault =
    shellState?.appSettings.gitDiffIncludeUntrackedDefault ?? false
  const parentBranchName =
    shellState?.directories.find((directory) => directory.id === composerDirectoryId)?.worktree
      ?.parentBranchName ?? null
  const includeUntrackedDiffFiles =
    includeUntrackedDiffFilesByChat[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
  const toggleGitOpsFileTree = useCallback(() => {
    setGitOpsFileTreeVisibilityByChat((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }))
  }, [gitOpsFileTreeStateKey, gitOpsFileTreeVisible, setGitOpsFileTreeVisibilityByChat])
  const toggleIncludeUntrackedDiffFiles = useCallback(() => {
    setIncludeUntrackedDiffFilesByChat((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(
        current[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
      ),
    }))
  }, [gitDiffIncludeUntrackedDefault, gitOpsFileTreeStateKey, setIncludeUntrackedDiffFilesByChat])
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
  const { centerDashboardFooter, centerChatFooter, floatingWorkspaceFooter } =
    getFloatingFooterLayoutState({
      activeChatData: activeChatData?.messages,
      activeChatLoading: controller.chat.activeLoading,
      activeView: state.activeView,
      showChatFooter,
    })
  const footerInset = showWorkspaceFooter && !floatingWorkspaceFooter ? footerHeight : 0
  const gitOpsReview = useGitOpsReviewController({
    baseline: diffBaseline,
    composerDirectoryId,
    handleAction,
    handleOpenWorktreeDiffFile,
    shellState,
    includeUntracked: includeUntrackedDiffFiles,
  })
  const { handleRemoveQueuedPrompt, pendingQueuedPromptIdsForSession, queuedPromptError } =
    useQueuedPromptCancellation({
      composerDirectoryId,
      handleAction,
      terminalConversationId,
    })

  const terminalDrawerInsetStyle = showDesktopTerminalDrawer
    ? { right: TERMINAL_DRAWER_OFFSET }
    : undefined
  const chatFooterStyle = getFloatingFooterStyle({
    centerDashboardFooter,
    centerChatFooter,
    showChatFooter,
    terminalDrawerInsetStyle,
  })
  const chatTimelineLoading = state.activeView === 'chat' && controller.chat.activeLoading

  return (
    <CodeWorkspaceViewContent
      terminalDrawerInsetStyle={terminalDrawerInsetStyle}
      terminalDrawerVisible={terminalDrawerVisible}
      footerInset={footerInset}
      mainViewRef={mainViewRef}
      state={state}
      showDiffInMainView={showDiffInMainView}
      composerDirectoryId={composerDirectoryId}
      directoryGitState={directoryGitState}
      parentBranchName={parentBranchName}
      diffBaseline={diffBaseline}
      gitOpsReview={gitOpsReview}
      diffRenderMode={diffRenderMode}
      gitOpsFileTreeVisible={gitOpsFileTreeVisible}
      includeUntrackedDiffFiles={includeUntrackedDiffFiles}
      controller={controller}
      shellState={shellState}
      activeComposerState={activeComposerState}
      currentDirectoryName={currentDirectoryName}
      workspaceContentClass={workspaceContentClass}
      activeChatData={activeChatData}
      chatTimelineLoading={chatTimelineLoading}
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
      showChatFooter={showChatFooter}
      centerChatFooter={centerChatFooter}
      chatFooterStyle={chatFooterStyle}
      sidebarAutoHidden={sidebarAutoHidden}
      terminalConversationId={terminalConversationId}
      diffLoadError={diffLoadError}
      setDiffLoadError={setDiffLoadError}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      setComposerLayoutVersion={setComposerLayoutVersion}
      handleCloseGitOpsView={handleCloseGitOpsView}
      handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
      pendingQueuedPromptIdsForSession={pendingQueuedPromptIdsForSession}
      queuedPromptError={queuedPromptError}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleOpenGitOpsView={handleOpenGitOpsView}
      handleToggleTerminal={handleToggleTerminal}
      showDesktopTerminalDrawer={showDesktopTerminalDrawer}
      toggleGitOpsFileTree={toggleGitOpsFileTree}
      toggleIncludeUntrackedDiffFiles={toggleIncludeUntrackedDiffFiles}
      showCodeSidebarFooter={showCodeSidebarFooter}
    />
  )
}
