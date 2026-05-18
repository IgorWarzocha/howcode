import { lazy, type RefObject, Suspense, useRef, useState } from 'react'
import { getLocalDraftChatGroupId, getPersistedSessionPath } from '../../../../shared/session-paths'
import type { AppShellController } from '../../app-shell/useAppShellController'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../../desktop/types'
import { cn } from '../../utils/cn'
import { useQueuedPromptRestore } from '../code/useQueuedPromptRestore'
import { useWorkspaceFooterHeight } from '../code/useWorkspaceFooterHeight'
import { ChatView } from './chat-view'
import { ChatComposerDock, type ChatWorkspaceComposerProps } from './chat-workspace-composer'
import { useChatArtifactDrawerState } from './useChatArtifactDrawerState'

const ArtifactPanel = lazy(() =>
  import('./artifacts/artifact-panel').then((module) => ({ default: module.ArtifactPanel })),
)

type ChatWorkspaceViewProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalSessionPath: string | null
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
  onArtifactDrawerOverlayChange?:
    | ((visible: boolean, onClose?: (() => void) | undefined) => void)
    | undefined
}

const NEW_CHAT_COMPOSER_TOP = '60%'
type ChatWorkspaceContentProps = ChatWorkspaceViewProps &
  ChatWorkspaceComposerProps & {
    rootRef: RefObject<HTMLDivElement | null>
    footerHeight: number
    shouldShowConversationContent: boolean
    composerLayoutVersion: number
    composerOverlayHeight: number
    handleLoadEarlierMessages: AppShellController['handleLoadEarlierMessages']
    conversationId: string | null | undefined
  }

function ChatWorkspaceMain({
  mainViewRef,
  activeThreadData,
  shouldShowConversationContent,
  composerLayoutVersion,
  composerOverlayHeight,
  controller,
  hasConversation,
  handleLoadEarlierMessages,
}: ChatWorkspaceContentProps) {
  return (
    <main ref={mainViewRef} className="h-full min-h-0 overflow-hidden pt-1.5">
      <ChatView
        key={activeThreadData?.sessionPath ?? 'new-chat'}
        messages={shouldShowConversationContent ? (activeThreadData?.messages ?? []) : []}
        previousMessageCount={activeThreadData?.previousMessageCount ?? 0}
        isStreaming={activeThreadData?.isStreaming ?? false}
        isCompacting={activeThreadData?.isCompacting ?? false}
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        sessionPath={activeThreadData?.sessionPath ?? null}
        loading={
          controller.activeThreadLoading || (hasConversation && !shouldShowConversationContent)
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
        className="absolute inset-x-0 top-0 overflow-hidden px-5"
        style={{ bottom: hasConversationLayout ? `${footerHeight}px` : '0px' }}
      >
        <ChatWorkspaceMain {...props} />
      </div>
      <footer
        ref={footerRef}
        className={cn(
          'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 px-5 pb-4',
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

function ChatArtifactDrawer(props: ChatWorkspaceContentProps) {
  const { artifactDrawer, conversationId } = props
  if (!(artifactDrawer.artifactDrawerPresent && !artifactDrawer.artifactsFullscreen)) return null
  return (
    <div
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden"
      style={artifactDrawer.artifactDrawerStyle}
    >
      <div
        ref={artifactDrawer.artifactDrawerRef}
        data-open={artifactDrawer.artifactDrawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${artifactDrawer.artifactDrawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <Suspense fallback={null}>
          <ArtifactPanel
            conversationId={conversationId ?? null}
            visible={artifactDrawer.artifactDrawerPresent}
            fullscreen={false}
            onToggleFullscreen={() => artifactDrawer.setArtifactsFullscreen(true)}
            onClose={artifactDrawer.handleCloseArtifacts}
          />
        </Suspense>
      </div>
    </div>
  )
}

function ChatArtifactFullscreen(props: ChatWorkspaceContentProps) {
  const { artifactDrawer, conversationId } = props
  if (!artifactDrawer.artifactsFullscreen) return null
  return (
    <div className="absolute inset-0 z-20 min-h-0 overflow-hidden">
      <Suspense fallback={null}>
        <ArtifactPanel
          conversationId={conversationId ?? null}
          visible={artifactDrawer.artifactsVisible}
          fullscreen={artifactDrawer.artifactsFullscreen}
          onToggleFullscreen={() => artifactDrawer.setArtifactsFullscreen(false)}
          onClose={artifactDrawer.handleCloseArtifacts}
        />
      </Suspense>
    </div>
  )
}

function ChatWorkspaceViewContent(props: ChatWorkspaceContentProps) {
  const { rootRef } = props
  return (
    <div ref={rootRef} className="relative min-h-0 flex-1 overflow-hidden">
      <ChatDesktopContent {...props} />
      <ChatArtifactDrawer {...props} />
      <ChatArtifactFullscreen {...props} />
    </div>
  )
}

export function ChatWorkspaceView({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  diffBaseline,
  diffRenderMode,
  terminalSessionPath,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
  onArtifactDrawerOverlayChange,
}: ChatWorkspaceViewProps) {
  const [composerPromptResetKey] = useState(0)
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    shellState,
    state,
  } = controller
  const footerHeight = useWorkspaceFooterHeight({ footerRef, visible: true })
  const conversationId = activeThreadData?.sessionPath ?? terminalSessionPath
  const hasConversation = (activeThreadData?.messages.length ?? 0) > 0
  const hasConversationLayout = hasConversation
  const hasPersistedChatSession = getPersistedSessionPath(terminalSessionPath) !== null
  const draftChatGroupId = getLocalDraftChatGroupId(terminalSessionPath)
  const shouldShowConversationContent = hasConversation
  const artifactDrawer = useChatArtifactDrawerState({
    conversationId,
    sidebarCompactMode,
    settingsOpen: state.settingsOpen,
    onArtifactDrawerOverlayChange,
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

  return (
    <ChatWorkspaceViewContent
      rootRef={rootRef}
      artifactDrawer={artifactDrawer}
      hasConversationLayout={hasConversationLayout}
      footerHeight={footerHeight}
      mainViewRef={mainViewRef}
      activeThreadData={activeThreadData}
      shouldShowConversationContent={shouldShowConversationContent}
      composerLayoutVersion={composerLayoutVersion}
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
      handleEditQueuedPrompt={handleEditQueuedPrompt}
      handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
      state={state}
      scopedRestoredQueuedPrompt={scopedRestoredQueuedPrompt}
      shellState={shellState}
      composerProjectId={composerProjectId}
      hasPersistedChatSession={hasPersistedChatSession}
      draftChatGroupId={draftChatGroupId}
      terminalSessionPath={terminalSessionPath}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      composerPromptResetKey={composerPromptResetKey}
      setComposerLayoutVersion={setComposerLayoutVersion}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleShowTakeoverTerminal={handleShowTakeoverTerminal}
      handleToggleTerminal={handleToggleTerminal}
      markRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      conversationId={conversationId ?? null}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      handleAction={handleAction}
    />
  )
}
