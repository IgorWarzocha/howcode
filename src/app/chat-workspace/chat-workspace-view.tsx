import { cn } from '@howaboua/howcode-sdk/utils/cn'
import {
  getLocalDraftWorkspaceId,
  getPersistedConversationId,
} from '@howcode/shared/conversation-ids'
import { useWorkspaceFooterHeight } from '@howcode/workspace-shell/useWorkspaceFooterHeight'
import { type RefObject, useRef, useState } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { InstalledChatRenderer } from '../component-system/chat-renderer-slot'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../ui/layout'
import type { WorkspaceArtifactDrawerState } from '../workspace-shell/useWorkspaceArtifactDrawerState'
import { WorkspaceSurfaceDock } from '../workspace-shell/workspace-surface-dock'
import { ChatComposerDock, type ChatWorkspaceComposerProps } from './chat-workspace-composer'
import type { ChatWorkspaceController } from './chat-workspace-contract'

type ChatWorkspaceViewProps = {
  artifactDrawer: WorkspaceArtifactDrawerState
  controller: ChatWorkspaceController
  activeComposerState: AppShellController['composer']['state']
  activeChatData: AppShellController['chat']['activeData']
  composerDirectoryId: string
  terminalConversationId: string | null
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
      <InstalledChatRenderer
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
        WORKSPACE_EDGE_PADDING_CLASS,
        artifactDrawer.artifactsFullscreen && 'hidden',
      )}
      style={
        artifactDrawer.artifactsFullscreen ? undefined : artifactDrawer.artifactDrawerInsetStyle
      }
    >
      <WorkspaceSurfaceDock
        conversationId={getPersistedConversationId(props.conversationId)}
        footerInset={hasConversationLayout ? footerHeight : 0}
      >
        <div
          className="absolute inset-x-0 top-0 overflow-hidden"
          style={{ bottom: hasConversationLayout ? `${footerHeight}px` : '0px' }}
        >
          <ChatWorkspaceMain {...props} />
        </div>
        <footer
          ref={footerRef}
          className={cn(
            'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 pb-4',
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
      </WorkspaceSurfaceDock>
    </div>
  )
}

function ChatWorkspaceViewContent(props: ChatWorkspaceContentProps) {
  const { rootRef } = props
  return (
    <div ref={rootRef} className="relative min-h-0 flex-1 overflow-hidden">
      <ChatDesktopContent {...props} />
    </div>
  )
}

export function ChatWorkspaceView({
  artifactDrawer,
  controller,
  activeComposerState,
  activeChatData,
  composerDirectoryId,
  terminalConversationId,
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
      state={state}
      shellState={shellState}
      composerDirectoryId={composerDirectoryId}
      hasPersistedChatSession={hasPersistedChatSession}
      draftWorkspaceId={draftWorkspaceId}
      terminalConversationId={terminalConversationId}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleToggleTerminal={handleToggleTerminal}
      conversationId={conversationId ?? null}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      handleAction={handleAction}
    />
  )
}
