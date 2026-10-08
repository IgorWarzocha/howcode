import {
  GitDiffPresentationProvider,
  useGitDetailLayout,
  useGitWorkspacePresentation,
} from '@howaboua/howcode-git/ui'
import { useRef, useState } from 'react'
import { useQueuedPromptCancellation } from '../../composer/useQueuedPromptCancellation'
import type { Message, View } from '../../types'
import { useWorkspaceFooterHeight } from '../../workspace-shell/useWorkspaceFooterHeight'
import { useWorkspacePresentationToggle } from '../../workspace-shell/workspace-presentation'
import type { DomainWorkspaceViewProps } from './domain-workspace-contract'
import { DomainWorkspaceViewContent } from './domain-workspace-footer'

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
}) {
  if (input.centerDashboardFooter) {
    return { top: EMPTY_COMPOSER_TOP }
  }

  if (!input.showChatFooter) {
    return undefined
  }

  return input.centerChatFooter ? { top: EMPTY_COMPOSER_TOP } : { bottom: 0 }
}

function getFloatingFooterLayoutState(input: {
  activeView: View
  activeChatData: Message[] | undefined
  activeChatLoading: boolean
  showChatFooter: boolean
  gitDetailOpen: boolean
}) {
  const hasChatConversation = input.showChatFooter && (input.activeChatData?.length ?? 0) > 0
  const hasChatConversationLayout = hasChatConversation || input.activeChatLoading
  const centerDashboardFooter = false
  const centerChatFooter =
    input.showChatFooter && !hasChatConversationLayout && !input.gitDetailOpen
  return {
    centerDashboardFooter,
    centerChatFooter,
    floatingWorkspaceFooter: centerChatFooter || centerDashboardFooter,
  }
}

function getDomainWorkspaceFlags(input: {
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
    showWorkspaceFooter: input.activeView === 'chat',
    showChatFooter: input.activeView === 'chat',
    showCodeSidebarFooter:
      (input.activeView === 'directories' || input.activeView === 'landing') &&
      !selectedDirectoryIdForView,
  }
}

export function DomainWorkspaceView({
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
}: DomainWorkspaceViewProps) {
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const gitDetailLayout = useGitDetailLayout()
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const handleAction = controller.desktop.handleAction
  const handleLoadEarlierMessages = controller.chat.loadEarlierMessages
  const handleOpenGitOpsView = controller.gitOps.open
  const handleOpenWorktreeDiffFile = controller.gitOps.openWorktreeFile
  const handleToggleTerminal = controller.terminal.toggle
  const listComposerAttachmentEntries = controller.composer.listAttachmentEntries
  const directoryGitState = controller.directories.gitState
  const { shellState } = controller.desktop
  const { state } = controller.workspace
  const gitDetailOpen = Boolean(
    composerDirectoryId && state.gitDetailDirectoryId === composerDirectoryId,
  )
  const { showWorkspaceFooter, showChatFooter, showCodeSidebarFooter } = getDomainWorkspaceFlags({
    activeView: state.activeView,
    hasSelectedDirectory: state.hasSelectedDirectory,
    selectedDirectoryId: state.selectedDirectoryId,
  })
  const {
    gitOpsFileTreeVisible,
    parentBranchName,
    includeUntrackedDiffFiles,
    toggleGitOpsFileTree,
    toggleIncludeUntrackedDiffFiles,
    diffLoadError,
    setDiffLoadError,
    gitOpsReview,
  } = useGitWorkspacePresentation({
    detailOpen: gitDetailOpen,
    composerDirectoryId,
    terminalConversationId,
    shellState,
    diffBaseline,
    handleAction,
    handleOpenWorktreeDiffFile,
  })
  const gitPresentation = useWorkspacePresentationToggle({
    id: composerDirectoryId,
    open: gitDetailOpen,
    confirmClose: gitOpsReview.hasPendingReview,
    onOpen: handleOpenGitOpsView,
    onClose: controller.gitOps.close,
  })
  const showDesktopTerminalDrawer = shouldShowDesktopTerminalDrawer(
    state.activeView,
    terminalDrawerVisible,
    terminalDrawerOverlay,
  )
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
      gitDetailOpen,
    })
  const footerInset = showWorkspaceFooter && !floatingWorkspaceFooter ? footerHeight : 0
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
  })
  const chatTimelineLoading = state.activeView === 'chat' && controller.chat.activeLoading

  return (
    <GitDiffPresentationProvider
      directoryId={composerDirectoryId}
      baseline={diffBaseline}
      includeUntracked={includeUntrackedDiffFiles}
      directoryGitState={directoryGitState}
      detailEnabled={gitDetailOpen}
      onOpenDetail={gitPresentation.toggle}
    >
      <DomainWorkspaceViewContent
        terminalDrawerInsetStyle={terminalDrawerInsetStyle}
        terminalDrawerVisible={terminalDrawerVisible}
        footerInset={footerInset}
        mainViewRef={mainViewRef}
        state={state}
        gitDetailOpen={gitDetailOpen}
        gitCloseConfirmation={gitPresentation.closeConfirmation}
        gitDetailLayout={gitDetailLayout}
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
        handleCloseGitOpsView={gitPresentation.close}
        handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
        pendingQueuedPromptIdsForSession={pendingQueuedPromptIdsForSession}
        queuedPromptError={queuedPromptError}
        setComposerOverlayHeight={setComposerOverlayHeight}
        handleToggleTerminal={handleToggleTerminal}
        showDesktopTerminalDrawer={showDesktopTerminalDrawer}
        toggleGitOpsFileTree={toggleGitOpsFileTree}
        toggleIncludeUntrackedDiffFiles={toggleIncludeUntrackedDiffFiles}
        showCodeSidebarFooter={showCodeSidebarFooter}
      />
    </GitDiffPresentationProvider>
  )
}
