import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { ChatView } from '@howcode/chat'
import { ArtifactDrawerViews, useChatArtifactDrawerState } from '@howcode/components/artifacts/ui'
import { useQueuedPromptCancellation } from '@howcode/composer/useQueuedPromptCancellation'
import {
  getLocalDraftWorkspaceId,
  getPersistedConversationId,
} from '@howcode/shared/conversation-ids'
import { useWorkspaceFooterHeight } from '@howcode/workspace-shell/useWorkspaceFooterHeight'
import { type RefObject, useRef, useState } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { DirectoryDiffBaseline, DirectoryDiffRenderMode } from '../desktop/types'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../ui/layout'
import { ChatComposerDock, type ChatWorkspaceComposerProps } from './chat-workspace-composer'
import type { ChatWorkspaceController } from './chat-workspace-contract'

type ChatWorkspaceViewProps = {
  controller: ChatWorkspaceController
  activeComposerState: AppShellController['composer']['state']
  activeChatData: AppShellController['chat']['activeData']
  composerDirectoryId: string
  diffBaseline: DirectoryDiffBaseline
  diffRenderMode: DirectoryDiffRenderMode
  terminalConversationId: string | null
  onSetDiffBaseline: (baseline: DirectoryDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: DirectoryDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

const NEW_CHAT_COMPOSER_TOP = '60%'
type ChatWorkspaceContentProps = ChatWorkspaceViewProps &
  ChatWorkspaceComposerProps & {
    rootRef: RefObject<HTMLDivElement | null>
    footerHeight: number
    shouldShowConversationContent: boolean
    composerLayoutVersion: number
    composerOverlayHeight: number
    handleLoadEarlierMessages: AppShellController['chat']['loadEarlierMessages']
    conversationId: string | null | undefined
  }

function ChatWorkspaceMain({
  mainViewRef,
  activeChatData,
  shouldShowConversationContent,
  composerLayoutVersion,
  composerOverlayHeight,
  controller,
  hasConversation,
  handleLoadEarlierMessages,
}: ChatWorkspaceContentProps) {
  return (
    <main ref={mainViewRef} className="h-full min-h-0 overflow-hidden">
      <ChatView
        key={activeChatData?.conversationId ?? 'new-chat'}
        messages={shouldShowConversationContent ? (activeChatData?.messages ?? []) : []}
        previousMessageCount={activeChatData?.previousMessageCount ?? 0}
        isStreaming={activeChatData?.isStreaming ?? false}
        isCompacting={activeChatData?.isCompacting ?? false}
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        conversationId={activeChatData?.conversationId ?? null}
        loading={
          controller.chat.activeLoading || (hasConversation && !shouldShowConversationContent)
        }
        onLoadEarlierMessages={handleLoadEarlierMessages}
        onLoadAroundMessage={handleLoadEarlierMessages}
      />
    </main>
  )
}

function ChatDesktopContent(props: ChatWorkspaceContentProps) {
  const { artifactDrawer, hasConversationLayout, footerHeight, footerRef } = props
  return (
    <div
      ref={artifactDrawer.desktopContentRef}
      className={cn(
        'motion-terminal-drawer-offset absolute inset-0 min-h-0 overflow-hidden',
        artifactDrawer.artifactsFullscreen && 'hidden',
      )}
      style={
        artifactDrawer.artifactsFullscreen ? undefined : artifactDrawer.artifactDrawerInsetStyle
      }
    >
      <div
        className={cn('absolute inset-x-0 top-0 overflow-hidden', WORKSPACE_EDGE_PADDING_CLASS)}
        style={{ bottom: hasConversationLayout ? `${footerHeight}px` : '0px' }}
      >
        <ChatWorkspaceMain {...props} />
      </div>
      <footer
        ref={footerRef}
        className={cn(
          'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 pb-4',
          WORKSPACE_EDGE_PADDING_CLASS,
          hasConversationLayout
            ? 'bottom-0 translate-y-0'
            : '-translate-y-1/2 transition-[top,transform] duration-300 ease-out',
        )}
        style={hasConversationLayout ? undefined : { top: NEW_CHAT_COMPOSER_TOP }}
      >
        <div className="pointer-events-auto grid gap-2.5">
          <ChatComposerDock {...props} />
        </div>
      </footer>
    </div>
  )
}

function ChatWorkspaceViewContent(props: ChatWorkspaceContentProps) {
  const { rootRef } = props
  return (
    <div ref={rootRef} className="relative min-h-0 flex-1 overflow-hidden">
      <ChatDesktopContent {...props} />
      <ArtifactDrawerViews
        artifactDrawer={props.artifactDrawer}
        conversationId={props.conversationId}
      />
    </div>
  )
}

export function ChatWorkspaceView({
  controller,
  activeComposerState,
  activeChatData,
  composerDirectoryId,
  diffBaseline,
  diffRenderMode,
  terminalConversationId,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: ChatWorkspaceViewProps) {
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const handleAction = controller.desktop.handleAction
  const handleLoadEarlierMessages = controller.chat.loadEarlierMessages
  const handleToggleTerminal = controller.terminal.toggle
  const listComposerAttachmentEntries = controller.composer.listAttachmentEntries
  const { shellState } = controller.desktop
  const { state } = controller.workspace
  const footerHeight = useWorkspaceFooterHeight({ footerRef, visible: true })
  const conversationId = activeChatData?.conversationId ?? terminalConversationId
  const hasConversation = (activeChatData?.messages.length ?? 0) > 0
  const hasConversationLayout = hasConversation
  const hasPersistedChatSession = getPersistedConversationId(terminalConversationId) !== null
  const draftWorkspaceId = getLocalDraftWorkspaceId(terminalConversationId)
  const shouldShowConversationContent = hasConversation
  const artifactDrawer = useChatArtifactDrawerState({
    conversationId,
    sidebarCompactMode,
    settingsOpen: state.settingsOpen,
  })
  const { handleRemoveQueuedPrompt, pendingQueuedPromptIdsForSession, queuedPromptError } =
    useQueuedPromptCancellation({
      composerDirectoryId,
      handleAction,
      terminalConversationId,
    })

  return (
    <ChatWorkspaceViewContent
      rootRef={rootRef}
      artifactDrawer={artifactDrawer}
      hasConversationLayout={hasConversationLayout}
      footerHeight={footerHeight}
      mainViewRef={mainViewRef}
      activeChatData={activeChatData}
      shouldShowConversationContent={shouldShowConversationContent}
      composerLayoutVersion={0}
      composerOverlayHeight={composerOverlayHeight}
      controller={controller}
      hasConversation={hasConversation}
      handleLoadEarlierMessages={handleLoadEarlierMessages}
      footerRef={footerRef}
      sidebarAutoHidden={sidebarAutoHidden}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
      sidebarCollapsed={sidebarCollapsed}
      activeComposerState={activeComposerState}
      pendingQueuedPromptIdsForSession={pendingQueuedPromptIdsForSession}
      queuedPromptError={queuedPromptError}
      handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
      state={state}
      shellState={shellState}
      composerDirectoryId={composerDirectoryId}
      hasPersistedChatSession={hasPersistedChatSession}
      draftWorkspaceId={draftWorkspaceId}
      terminalConversationId={terminalConversationId}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleToggleTerminal={handleToggleTerminal}
      conversationId={conversationId ?? null}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      handleAction={handleAction}
    />
  )
}
