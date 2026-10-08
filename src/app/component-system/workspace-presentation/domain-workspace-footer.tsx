import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { getComposerRuntimeModel, QueuedPromptsCard } from '../../composer/index'
import type { Message } from '../../types'
import { FALLBACK_APP_SETTINGS } from '../../workspace-shell/default-app-settings'
import { DesktopComposerStatusModelPicker } from '../../workspace-shell/desktop-composer-status'
import { Composer } from '../../workspace-shell/index'
import { WorkspaceComposerDock } from '../../workspace-shell/workspace-composer-dock'
import type { DomainWorkspaceContentProps } from './domain-workspace-contract'
import { DomainWorkspaceLayout, DomainWorkspaceMainArea } from './domain-workspace-main-area'

function getReplyActivityKey(messages: readonly Message[]) {
  const replyMessageIds: string[] = []
  for (const message of messages) {
    if (message.role !== 'user') replyMessageIds.push(message.id)
  }
  return replyMessageIds.join('|')
}

function CodeSidebarToggleButton(props: DomainWorkspaceContentProps) {
  const { sidebarCollapsed, sidebarCompactMode, onToggleSidebar } = props
  const sidebarHidden = sidebarCollapsed || sidebarCompactMode
  if (sidebarCompactMode && !sidebarHidden) return null
  const label = sidebarHidden ? 'Show sidebar' : 'Hide sidebar'
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-placement="right"
    >
      {sidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function CodeQueuedPrompts(props: DomainWorkspaceContentProps) {
  const {
    activeComposerState,
    pendingQueuedPromptIdsForSession,
    handleRemoveQueuedPrompt,
    queuedPromptError,
  } = props
  return (
    <QueuedPromptsCard
      prompts={activeComposerState?.queuedPrompts ?? []}
      pendingPromptIds={pendingQueuedPromptIdsForSession}
      errorMessage={queuedPromptError}
      onRemovePrompt={(prompt) => {
        void handleRemoveQueuedPrompt(prompt)
      }}
    />
  )
}

function CodeChatComposer(props: DomainWorkspaceContentProps) {
  const {
    state,
    activeComposerState,
    activeChatData,
    shellState,
    composerDirectoryId,
    directoryGitState,
    parentBranchName,
    diffBaseline,
    terminalConversationId,
    onSetDiffBaseline,
    setComposerOverlayHeight,
    footerRef,
    controller,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    handleAction,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const composerRuntime = getComposerRuntimeModel(activeComposerState)
  return (
    <Composer
      activeView={state.activeView}
      runtime={composerRuntime}
      messages={activeChatData?.messages}
      isStreaming={activeChatData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeChatData?.messages ?? [])}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
      directoryId={composerDirectoryId}
      directoryGitState={directoryGitState}
      parentBranchName={parentBranchName}
      diffBaseline={diffBaseline}
      conversationId={terminalConversationId}
      dictationModelId={appSettings.dictationModelId}
      dictationMaxDurationSeconds={appSettings.dictationMaxDurationSeconds}
      favoriteFolders={appSettings.favoriteFolders}
      showDictationButton={appSettings.showDictationButton}
      hoverToFocus={appSettings.hoverToFocus}
      hoverToBlur={appSettings.hoverToBlur}
      composerSendMode={appSettings.composerSendMode}
      keybindings={appSettings.keybindings}
      onSetDiffBaseline={onSetDiffBaseline}
      onOverlayHeightChange={setComposerOverlayHeight}
      workspaceFooterRef={footerRef}
      onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      onToggleTerminal={handleToggleTerminal}
      terminalVisible={state.terminalVisible}
      preferPortalModelPopover={state.activeView === 'directory'}
      onListAttachmentEntries={listComposerAttachmentEntries}
      onAction={handleAction}
    />
  )
}

function CodeChatComposerCenter(props: DomainWorkspaceContentProps) {
  return (
    <div className="grid gap-0">
      <CodeQueuedPrompts {...props} />
      <div>
        <CodeChatComposer {...props} />
      </div>
    </div>
  )
}

function CodeFooterRight(props: DomainWorkspaceContentProps) {
  const {
    state,
    showDesktopTerminalDrawer,
    activeComposerState,
    composerDirectoryId,
    terminalConversationId,
    handleAction,
  } = props
  if (state.activeView === 'chat' && !showDesktopTerminalDrawer)
    return (
      <DesktopComposerStatusModelPicker
        availableModels={activeComposerState?.availableModels ?? []}
        availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
        composerProfile="coding"
        contextUsage={activeComposerState?.contextUsage ?? null}
        model={activeComposerState?.currentModel ?? null}
        directoryId={composerDirectoryId}
        conversationId={terminalConversationId}
        thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
        onAction={handleAction}
      />
    )
  return null
}

function DomainWorkspaceChatFooter(props: DomainWorkspaceContentProps) {
  const {
    footerRef,
    showChatFooter,
    centerChatFooter,
    chatFooterStyle,
    sidebarAutoHidden,
    sidebarCollapsed,
    state,
  } = props
  return (
    <footer
      ref={footerRef}
      className={cn(
        'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 pb-4',
        centerChatFooter || state.activeView === 'directory'
          ? 'transition-[top,transform] duration-300 ease-out'
          : 'bottom-0',
        (centerChatFooter || state.activeView === 'directory') && '-translate-y-1/2',
        showChatFooter && !centerChatFooter && 'translate-y-0',
      )}
      style={chatFooterStyle}
    >
      <div className="pointer-events-auto grid gap-2.5">
        <WorkspaceComposerDock
          compactControls={sidebarAutoHidden || sidebarCollapsed}
          left={<CodeSidebarToggleButton {...props} />}
          center={<CodeChatComposerCenter {...props} />}
          rightClassName="min-[1400px]:opacity-100 opacity-0"
          right={<CodeFooterRight {...props} />}
        />
      </div>
    </footer>
  )
}

function CodeSidebarFooter(props: DomainWorkspaceContentProps) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
      <div className="pointer-events-auto mb-1.5">
        <CodeSidebarToggleButton {...props} />
      </div>
    </footer>
  )
}

function DomainWorkspaceFooterArea(props: DomainWorkspaceContentProps) {
  const { showWorkspaceFooter, showCodeSidebarFooter } = props
  if (showWorkspaceFooter) return <DomainWorkspaceChatFooter {...props} />
  if (showCodeSidebarFooter) return <CodeSidebarFooter {...props} />
  return null
}

export function DomainWorkspaceViewContent(props: DomainWorkspaceContentProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <DomainWorkspaceLayout {...props}>
        <DomainWorkspaceMainArea {...props} />
        <DomainWorkspaceFooterArea {...props} />
      </DomainWorkspaceLayout>
    </div>
  )
}
