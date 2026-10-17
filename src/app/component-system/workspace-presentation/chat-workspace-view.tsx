import { useGitPresentation } from '@howaboua/howcode-sdk/git-renderer'
import { useContext, useRef, useState } from 'react'
import type { Message, View } from '../../types'
import { useWorkspaceFooterHeight } from '../../workspace-shell/useWorkspaceFooterHeight'
import { RendererHostsContext } from '../installed-renderer-context'
import type { ChatWorkspaceViewProps } from './chat-workspace-contract'
import { ChatWorkspaceViewContent } from './chat-workspace-footer'

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

function getFloatingFooterLayoutState(input: {
  activeChatData: Message[] | undefined
  activeChatLoading: boolean
  showChatFooter: boolean
  gitDetailOpen: boolean
}) {
  const hasConversationLayout = (input.activeChatData?.length ?? 0) > 0 || input.activeChatLoading
  const centerChatFooter = input.showChatFooter && !hasConversationLayout && !input.gitDetailOpen
  return { centerChatFooter, floatingWorkspaceFooter: centerChatFooter }
}

function getChatWorkspaceFlags(input: {
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
    showWorkspaceFooter: input.activeView === 'chat' || input.activeView === 'workspace',
    showChatFooter: input.activeView === 'chat' || input.activeView === 'workspace',
    showSidebarFooter:
      (input.activeView === 'directories' || input.activeView === 'landing') &&
      !selectedDirectoryIdForView,
  }
}

export function ChatWorkspaceView({
  artifactDrawer,
  controller,
  activeComposerState,
  activeChatData,
  composerDirectoryId,
  currentDirectoryName,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalConversationId,
  workspaceContentClass,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: ChatWorkspaceViewProps) {
  const publishedGitPresentation = useGitPresentation()
  const gitRevision = useContext(RendererHostsContext).find(
    (renderer) => renderer.name === '@howaboua/howcode-git',
  )?.reference?.revision
  const gitPresentation =
    publishedGitPresentation?.revision === gitRevision ? publishedGitPresentation : null
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const handleAction = controller.desktop.handleAction
  const handleLoadEarlierMessages = controller.chat.loadEarlierMessages
  const handleToggleTerminal = controller.terminal.toggle
  const listComposerAttachmentEntries = controller.composer.listAttachmentEntries
  const directoryGitState = controller.directories.gitState
  const { shellState } = controller.desktop
  const { state } = controller.workspace
  const gitDetailOpen = gitPresentation?.detailOpen ?? false
  const { showWorkspaceFooter, showChatFooter, showSidebarFooter } = getChatWorkspaceFlags({
    activeView: state.activeView,
    hasSelectedDirectory: state.hasSelectedDirectory,
    selectedDirectoryId: state.selectedDirectoryId,
  })
  const parentBranchName =
    shellState?.directories.find((directory) => directory.id === composerDirectoryId)?.worktree
      ?.parentBranchName ?? null
  const showDesktopTerminalDrawer = shouldShowDesktopTerminalDrawer(
    state.activeView,
    terminalDrawerVisible,
    terminalDrawerOverlay,
  )
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  })
  const { centerChatFooter, floatingWorkspaceFooter } = getFloatingFooterLayoutState({
    activeChatData: activeChatData?.messages,
    activeChatLoading: controller.chat.activeLoading,
    showChatFooter,
    gitDetailOpen,
  })
  const footerInset = showWorkspaceFooter && !floatingWorkspaceFooter ? footerHeight : 0

  const terminalDrawerInsetStyle = showDesktopTerminalDrawer
    ? { right: TERMINAL_DRAWER_OFFSET }
    : undefined
  const chatFooterStyle = centerChatFooter ? { top: EMPTY_COMPOSER_TOP } : { bottom: 0 }
  const chatTimelineLoading = state.activeView === 'chat' && controller.chat.activeLoading

  return (
    <ChatWorkspaceViewContent
      artifactDrawer={artifactDrawer}
      terminalDrawerInsetStyle={terminalDrawerInsetStyle}
      terminalDrawerVisible={terminalDrawerVisible}
      footerInset={footerInset}
      mainViewRef={mainViewRef}
      state={state}
      gitDetailOpen={gitDetailOpen}
      gitPresentation={gitPresentation}
      composerDirectoryId={composerDirectoryId}
      directoryGitState={directoryGitState}
      parentBranchName={parentBranchName}
      controller={controller}
      shellState={shellState}
      activeComposerState={activeComposerState}
      currentDirectoryName={currentDirectoryName}
      workspaceContentClass={workspaceContentClass}
      activeChatData={activeChatData}
      chatTimelineLoading={chatTimelineLoading}
      composerLayoutVersion={gitPresentation?.layoutRevision ?? 0}
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
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleToggleTerminal={handleToggleTerminal}
      showDesktopTerminalDrawer={showDesktopTerminalDrawer}
      showSidebarFooter={showSidebarFooter}
    />
  )
}
