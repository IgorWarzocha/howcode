import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { getLocalDraftChatGroupId, getPersistedSessionPath } from '../../../../shared/session-paths'
import type { AppShellController } from '../../app-shell/useAppShellController'
import { Composer } from '../../components/workspace/composer'
import { QueuedPromptsCard } from '../../components/workspace/composer/queued-prompts-card'
import { WorkspaceComposerDock } from '../../components/workspace/workspace-composer-dock'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../../desktop/types'
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import type { Message } from '../../types'
import { cn } from '../../utils/cn'
import { DesktopComposerStatus } from '../code/desktop-composer-status'
import { useQueuedPromptRestore } from '../code/useQueuedPromptRestore'
import { useWorkspaceFooterHeight } from '../code/useWorkspaceFooterHeight'
import { ChatView } from './chat-view'

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

const ARTIFACT_DRAWER_WIDTH = 'clamp(320px, calc(100% - 820px), 760px)'
const NEW_CHAT_COMPOSER_TOP = '60%'
const FALLBACK_APP_SETTINGS = {
  chatModel: null,
  chatThinkingLevel: null,
  codeModel: null,
  codeThinkingLevel: null,
  gitCommitMessageModel: null,
  gitCommitMessageThinkingLevel: 'off',
  skillCreatorModel: null,
  skillCreatorThinkingLevel: 'off',
  composerStreamingBehavior: 'followUp',
  dictationModelId: null,
  dictationMaxDurationSeconds: 180,
  showDictationButton: true,
  favoriteFolders: [],
  projectImportState: null,
  preferredProjectLocation: null,
  initializeGitOnProjectCreate: false,
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'head' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  howcodeNativeAskQuestions: false,
  piTuiTakeover: false,
  hoverToFocus: true,
  hoverToBlur: false,
} satisfies AppSettings

type ChatWorkspaceContentProps = ChatWorkspaceViewProps &
  ReturnType<typeof useQueuedPromptRestore> & {
    rootRef: RefObject<HTMLDivElement | null>
    desktopContentRef: RefObject<HTMLDivElement | null>
    artifactDrawerRef: RefObject<HTMLDivElement | null>
    footerRef: RefObject<HTMLElement | null>
    mainViewRef: RefObject<HTMLElement | null>
    artifactsFullscreen: boolean
    setArtifactsFullscreen: Dispatch<SetStateAction<boolean>>
    artifactDrawerInsetStyle: { right: string } | undefined
    artifactDrawerStyle: { width: string } | undefined
    artifactDrawerPresent: boolean
    artifactDrawerVisible: boolean
    artifactsVisible: boolean
    showDesktopArtifactDrawer: boolean
    hasConversation: boolean
    hasConversationLayout: boolean
    shouldShowConversationContent: boolean
    footerHeight: number
    composerLayoutVersion: number
    setComposerLayoutVersion: Dispatch<SetStateAction<number>>
    composerOverlayHeight: number
    setComposerOverlayHeight: Dispatch<SetStateAction<number>>
    composerPromptResetKey: number
    conversationId: string | null | undefined
    hasPersistedChatSession: boolean
    draftChatGroupId: string | null
    setArtifactsVisibleByConversation: Dispatch<SetStateAction<Record<string, boolean>>>
    handleAction: AppShellController['handleAction']
    handleLoadEarlierMessages: AppShellController['handleLoadEarlierMessages']
    handleShowTakeoverTerminal: AppShellController['handleShowTakeoverTerminal']
    handleToggleTerminal: AppShellController['handleToggleTerminal']
    listComposerAttachmentEntries: AppShellController['listComposerAttachmentEntries']
    shellState: AppShellController['shellState']
    state: AppShellController['state']
    handleCloseArtifacts: () => void
  }

function getReplyActivityKey(messages: readonly Message[]) {
  return messages
    .filter((message) => message.role !== 'user')
    .map((message) => message.id)
    .join('|')
}

function SidebarToggleButton(props: ChatWorkspaceContentProps) {
  const { sidebarCollapsed, onToggleSidebar } = props
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip-placement="right"
    >
      {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function ChatWorkspaceMain(props: ChatWorkspaceContentProps) {
  const {
    mainViewRef,
    activeThreadData,
    shouldShowConversationContent,
    composerLayoutVersion,
    composerOverlayHeight,
    controller,
    hasConversation,
    handleLoadEarlierMessages,
  } = props
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
        loading={
          controller.activeThreadLoading || (hasConversation && !shouldShowConversationContent)
        }
        onLoadEarlierMessages={handleLoadEarlierMessages}
      />
    </main>
  )
}

function getChatGroupId(props: ChatWorkspaceContentProps) {
  const { hasPersistedChatSession, draftChatGroupId, controller } = props
  if (hasPersistedChatSession) return null
  return draftChatGroupId ?? controller.selectedChatGroupId
}

function getToggleArtifacts(props: ChatWorkspaceContentProps) {
  const { hasConversationLayout, conversationId, setArtifactsVisibleByConversation } = props
  if (!(hasConversationLayout && conversationId)) return undefined
  return () =>
    setArtifactsVisibleByConversation((current: Record<string, boolean>) => ({
      ...current,
      [conversationId]: !(current[conversationId] ?? false),
    }))
}

function ChatQueuedPrompts(props: ChatWorkspaceContentProps) {
  const {
    activeComposerState,
    pendingQueuedPromptIdsForSession,
    handleEditQueuedPrompt,
    handleRemoveQueuedPrompt,
  } = props
  return (
    <QueuedPromptsCard
      prompts={activeComposerState?.queuedPrompts ?? []}
      pendingPromptIds={pendingQueuedPromptIdsForSession}
      onEditPrompt={(prompt) => {
        void handleEditQueuedPrompt(prompt)
      }}
      onRemovePrompt={(prompt) => {
        void handleRemoveQueuedPrompt(prompt)
      }}
    />
  )
}

function ChatComposer(props: ChatWorkspaceContentProps) {
  const {
    activeComposerState,
    state,
    activeThreadData,
    scopedRestoredQueuedPrompt,
    shellState,
    composerProjectId,
    diffBaseline,
    terminalSessionPath,
    diffRenderMode,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    composerPromptResetKey,
    setComposerLayoutVersion,
    setComposerOverlayHeight,
    mainViewRef,
    footerRef,
    handleShowTakeoverTerminal,
    markRestoredQueuedPromptApplied,
    handleToggleTerminal,
    hasConversationLayout,
    hasConversation,
    artifactsVisible,
    listComposerAttachmentEntries,
    handleAction,
    controller,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <Composer
      activeView={state.activeView}
      model={activeComposerState?.currentModel ?? null}
      contextUsage={activeComposerState?.contextUsage ?? null}
      availableModels={activeComposerState?.availableModels ?? []}
      isStreaming={activeThreadData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeThreadData?.messages ?? [])}
      isCompacting={activeComposerState?.isCompacting ?? false}
      isExtensionCommandRunning={activeComposerState?.isExtensionCommandRunning ?? false}
      nativeAskQuestionsRequest={activeComposerState?.nativeAskQuestionsRequest ?? null}
      thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
      restoredQueuedPrompt={scopedRestoredQueuedPrompt}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
      availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
      projectId={composerProjectId}
      chatGroupId={getChatGroupId(props)}
      projectGitState={null}
      diffBaseline={diffBaseline}
      sessionPath={terminalSessionPath}
      dictationModelId={appSettings.dictationModelId}
      dictationMaxDurationSeconds={appSettings.dictationMaxDurationSeconds}
      favoriteFolders={appSettings.favoriteFolders}
      showDictationButton={appSettings.showDictationButton}
      hoverToFocus={appSettings.hoverToFocus}
      hoverToBlur={appSettings.hoverToBlur}
      diffRenderMode={diffRenderMode}
      diffComments={[]}
      diffCommentCount={0}
      diffCommentsSending={false}
      diffCommentError={null}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      onSendDiffComments={() => {
        /* Diff comments are disabled in chat workspace mode. */
      }}
      onSelectDiffComment={() => {
        /* Diff comments are disabled in chat workspace mode. */
      }}
      promptResetKey={composerPromptResetKey}
      onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
      onOverlayHeightChange={setComposerOverlayHeight}
      mainViewRef={mainViewRef}
      workspaceFooterRef={footerRef}
      onOpenTakeoverTerminal={handleShowTakeoverTerminal}
      onOpenGitOpsView={() => {
        /* Already in chat workspace. */
      }}
      onOpenSettingsView={() => controller.handleShowView('settings')}
      onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      onToggleTerminal={handleToggleTerminal}
      onToggleArtifacts={getToggleArtifacts(props)}
      artifactsAvailable={hasConversation}
      showTerminalControls={false}
      artifactsVisible={artifactsVisible}
      terminalVisible={state.terminalVisible}
      preferSideFilePicker={!hasConversationLayout}
      preferSideModelPopover={!hasConversationLayout}
      onListAttachmentEntries={listComposerAttachmentEntries}
      onAction={handleAction}
    />
  )
}

function ChatComposerCenter(props: ChatWorkspaceContentProps) {
  return (
    <div className="grid gap-0">
      <ChatQueuedPrompts {...props} />
      <ChatComposer {...props} />
    </div>
  )
}

function ChatComposerDock(props: ChatWorkspaceContentProps) {
  const { sidebarAutoHidden, sidebarCompactMode, showDesktopArtifactDrawer, activeComposerState } =
    props
  return (
    <WorkspaceComposerDock
      compactControls={sidebarAutoHidden}
      left={sidebarCompactMode ? null : <SidebarToggleButton {...props} />}
      center={<ChatComposerCenter {...props} />}
      rightClassName={cn(
        'opacity-0 min-[1400px]:opacity-100',
        showDesktopArtifactDrawer && 'invisible',
      )}
      right={
        <DesktopComposerStatus
          contextUsage={activeComposerState?.contextUsage ?? null}
          model={activeComposerState?.currentModel ?? null}
          thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
        />
      }
    />
  )
}

function ChatDesktopContent(props: ChatWorkspaceContentProps) {
  const {
    desktopContentRef,
    artifactsFullscreen,
    artifactDrawerInsetStyle,
    hasConversationLayout,
    footerHeight,
    footerRef,
  } = props
  return (
    <div
      ref={desktopContentRef}
      className={cn(
        'motion-terminal-drawer-offset absolute inset-0 min-h-0 overflow-hidden',
        artifactsFullscreen && 'hidden',
      )}
      style={artifactsFullscreen ? undefined : artifactDrawerInsetStyle}
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
  const {
    artifactDrawerPresent,
    artifactsFullscreen,
    artifactDrawerStyle,
    artifactDrawerRef,
    artifactDrawerVisible,
    conversationId,
    handleCloseArtifacts,
    setArtifactsFullscreen,
  } = props
  if (!(artifactDrawerPresent && !artifactsFullscreen)) return null
  return (
    <div
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden"
      style={artifactDrawerStyle}
    >
      <div
        ref={artifactDrawerRef}
        data-open={artifactDrawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${artifactDrawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <Suspense fallback={null}>
          <ArtifactPanel
            conversationId={conversationId ?? null}
            visible={artifactDrawerPresent}
            fullscreen={false}
            onToggleFullscreen={() => setArtifactsFullscreen(true)}
            onClose={handleCloseArtifacts}
          />
        </Suspense>
      </div>
    </div>
  )
}

function ChatArtifactFullscreen(props: ChatWorkspaceContentProps) {
  const {
    artifactsFullscreen,
    conversationId,
    artifactsVisible,
    handleCloseArtifacts,
    setArtifactsFullscreen,
  } = props
  if (!artifactsFullscreen) return null
  return (
    <div className="absolute inset-0 z-20 min-h-0 overflow-hidden">
      <Suspense fallback={null}>
        <ArtifactPanel
          conversationId={conversationId ?? null}
          visible={artifactsVisible}
          fullscreen={artifactsFullscreen}
          onToggleFullscreen={() => setArtifactsFullscreen(false)}
          onClose={handleCloseArtifacts}
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
  const [artifactsVisibleByConversation, setArtifactsVisibleByConversation] = useState<
    Record<string, boolean>
  >({})
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const desktopContentRef = useRef<HTMLDivElement>(null)
  const artifactDrawerRef = useRef<HTMLDivElement>(null)
  const artifactOverlayPreviousFocusRef = useRef<HTMLElement | null>(null)
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
  const artifactsVisible = conversationId
    ? (artifactsVisibleByConversation[conversationId] ?? false)
    : false
  const artifactDrawerVisible = artifactsVisible && !artifactsFullscreen
  const artifactDrawerOverlay = sidebarCompactMode
  const showDesktopArtifactDrawer = artifactDrawerVisible && !artifactDrawerOverlay
  const artifactDrawerPresent = useAnimatedPresence(artifactDrawerVisible)
  const artifactDrawerInsetStyle = showDesktopArtifactDrawer
    ? { right: ARTIFACT_DRAWER_WIDTH }
    : undefined
  const artifactDrawerStyle = artifactDrawerPresent
    ? { width: artifactDrawerOverlay ? '100%' : ARTIFACT_DRAWER_WIDTH }
    : undefined
  const previousConversationIdRef = useRef<string | null | undefined>(conversationId)
  const shouldShowConversationContent = hasConversation
  const handleCloseArtifacts = useCallback(() => {
    if (conversationId) {
      setArtifactsVisibleByConversation((current: Record<string, boolean>) => ({
        ...current,
        [conversationId]: false,
      }))
    }
    setArtifactsFullscreen(false)
  }, [conversationId])

  useEffect(() => {
    const desktopContentElement = desktopContentRef.current
    if (!desktopContentElement) return
    const shouldInertDesktopContent = artifactDrawerOverlay && artifactDrawerVisible
    if (shouldInertDesktopContent) {
      desktopContentElement.setAttribute('inert', '')
      desktopContentElement.setAttribute('aria-hidden', 'true')
      return () => {
        desktopContentElement.removeAttribute('inert')
        desktopContentElement.removeAttribute('aria-hidden')
      }
    }

    desktopContentElement.removeAttribute('inert')
    desktopContentElement.removeAttribute('aria-hidden')
  }, [artifactDrawerOverlay, artifactDrawerVisible])

  useEffect(() => {
    if (!(artifactDrawerOverlay && artifactDrawerVisible)) return
    const drawerElement = artifactDrawerRef.current
    if (!drawerElement) return
    if (document.activeElement && drawerElement.contains(document.activeElement)) return
    artifactOverlayPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const animationFrame = window.requestAnimationFrame(() => {
      const focusTarget = drawerElement.querySelector<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      focusTarget?.focus()
    })
    return () => {
      window.cancelAnimationFrame(animationFrame)
      const previousFocus = artifactOverlayPreviousFocusRef.current
      artifactOverlayPreviousFocusRef.current = null
      if (!previousFocus?.isConnected) return
      if (
        document.activeElement instanceof HTMLElement &&
        drawerElement.contains(document.activeElement)
      ) {
        previousFocus.focus()
      }
    }
  }, [artifactDrawerOverlay, artifactDrawerVisible])

  useEffect(() => {
    if (!window.piDesktop?.subscribe) return
    if (!conversationId) return
    return window.piDesktop.subscribe((event) => {
      if (event.type !== 'artifact-update') return
      if (event.conversationId !== conversationId) return
      setArtifactsVisibleByConversation((current: Record<string, boolean>) => ({
        ...current,
        [conversationId]: true,
      }))
    })
  }, [conversationId])

  if (previousConversationIdRef.current !== conversationId) {
    previousConversationIdRef.current = conversationId
    if (artifactsFullscreen) setArtifactsFullscreen(false)
  }

  useEffect(() => {
    if (!artifactsVisible) setArtifactsFullscreen(false)
  }, [artifactsVisible])

  useEffect(() => {
    const overlayVisible = artifactDrawerVisible && artifactDrawerOverlay
    onArtifactDrawerOverlayChange?.(
      overlayVisible,
      overlayVisible ? handleCloseArtifacts : undefined,
    )
    return () => onArtifactDrawerOverlayChange?.(false)
  }, [
    artifactDrawerOverlay,
    artifactDrawerVisible,
    handleCloseArtifacts,
    onArtifactDrawerOverlayChange,
  ])

  useEffect(() => {
    if (!(artifactsVisible && (artifactDrawerOverlay || artifactsFullscreen))) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (state.settingsOpen) return
      event.preventDefault()
      event.stopPropagation()
      if (artifactsFullscreen) {
        setArtifactsFullscreen(false)
        return
      }
      if (!conversationId) return
      setArtifactsVisibleByConversation((current: Record<string, boolean>) => ({
        ...current,
        [conversationId]: false,
      }))
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [
    artifactsFullscreen,
    artifactDrawerOverlay,
    artifactsVisible,
    conversationId,
    state.settingsOpen,
  ])
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
      desktopContentRef={desktopContentRef}
      artifactsFullscreen={artifactsFullscreen}
      artifactDrawerInsetStyle={artifactDrawerInsetStyle}
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
      setArtifactsVisibleByConversation={setArtifactsVisibleByConversation}
      artifactsVisible={artifactsVisible}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      handleAction={handleAction}
      showDesktopArtifactDrawer={showDesktopArtifactDrawer}
      artifactDrawerPresent={artifactDrawerPresent}
      artifactDrawerStyle={artifactDrawerStyle}
      artifactDrawerRef={artifactDrawerRef}
      artifactDrawerVisible={artifactDrawerVisible}
      handleCloseArtifacts={handleCloseArtifacts}
      setArtifactsFullscreen={setArtifactsFullscreen}
    />
  )
}
