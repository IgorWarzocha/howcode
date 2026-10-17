import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { SpeakerSelector } from '@howcode/components/people/ui'
import {
  getLocalDraftWorkspaceId,
  getPersistedConversationId,
} from '@howcode/shared/conversation-ids'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Message } from '../../types'
import { FALLBACK_APP_SETTINGS } from '../../workspace-shell/default-app-settings'
import { WorkspaceComposerDock } from '../../workspace-shell/workspace-composer-dock'
import {
  InstalledComposer as Composer,
  InstalledComposerModelPicker as DesktopComposerStatusModelPicker,
  InstalledQueuedPrompts,
} from '../composer-renderer-slot'
import { getComposerRuntimeModel } from '../composer-runtime'
import type { ChatWorkspaceContentProps } from './chat-workspace-contract'
import { ChatWorkspaceLayout, ChatWorkspaceMainArea } from './chat-workspace-main-area'

function getReplyActivityKey(messages: readonly Message[]) {
  const replyMessageIds: string[] = []
  for (const message of messages) {
    if (message.role !== 'user') replyMessageIds.push(message.id)
  }
  return replyMessageIds.join('|')
}

function SidebarToggleButton(props: ChatWorkspaceContentProps) {
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

function QueuedPrompts({
  activeComposerState,
  composerDirectoryId,
  terminalConversationId,
  handleAction,
}: ChatWorkspaceContentProps) {
  return (
    <InstalledQueuedPrompts
      prompts={activeComposerState?.queuedPrompts ?? []}
      directoryId={composerDirectoryId}
      conversationId={terminalConversationId}
      onAction={handleAction}
    />
  )
}

function ChatComposer(props: ChatWorkspaceContentProps) {
  const {
    state,
    artifactDrawer,
    activeComposerState,
    activeChatData,
    shellState,
    composerDirectoryId,
    directoryGitState,
    parentBranchName,
    terminalConversationId,
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
      availableExtensions={activeComposerState?.availableExtensions ?? []}
      selectedExtensions={activeComposerState?.selectedExtensions ?? []}
      messages={activeChatData?.messages}
      isStreaming={activeChatData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeChatData?.messages ?? [])}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
      directoryId={composerDirectoryId}
      workspaceId={
        getPersistedConversationId(terminalConversationId)
          ? null
          : (getLocalDraftWorkspaceId(terminalConversationId) ??
            controller.workspaces.selectedWorkspaceId)
      }
      directoryGitState={directoryGitState}
      parentBranchName={parentBranchName}
      conversationId={terminalConversationId}
      favoriteFolders={appSettings.favoriteFolders}
      hoverToFocus={appSettings.hoverToFocus}
      hoverToBlur={appSettings.hoverToBlur}
      composerSendMode={appSettings.composerSendMode}
      keybindings={appSettings.keybindings}
      onOverlayHeightChange={setComposerOverlayHeight}
      workspaceFooterRef={footerRef}
      onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      onToggleTerminal={handleToggleTerminal}
      onToggleArtifacts={props.centerChatFooter ? undefined : artifactDrawer.toggleArtifacts}
      artifactsAvailable={terminalConversationId !== null}
      artifactsVisible={artifactDrawer.artifactsVisible}
      artifactRendererName={artifactDrawer.artifactRendererName}
      onToggleArtifactRenderer={artifactDrawer.toggleArtifacts}
      terminalVisible={state.terminalVisible}
      preferPortalModelPopover={props.centerChatFooter}
      onListAttachmentEntries={listComposerAttachmentEntries}
      onAction={handleAction}
    />
  )
}

function ChatComposerCenter(props: ChatWorkspaceContentProps) {
  return (
    <div className="grid gap-0">
      <SpeakerSelector
        people={props.shellState?.appSettings.people ?? []}
        onManage={() =>
          props.controller.navigation.showView('settings', { settingId: 'general.people' })
        }
      />
      <QueuedPrompts {...props} />
      <div>
        <ChatComposer {...props} />
      </div>
    </div>
  )
}

function ChatFooterRight(props: ChatWorkspaceContentProps) {
  const {
    state,
    showDesktopTerminalDrawer,
    activeComposerState,
    composerDirectoryId,
    terminalConversationId,
    handleAction,
  } = props
  if (
    (state.activeView === 'chat' || state.activeView === 'workspace') &&
    !showDesktopTerminalDrawer
  )
    return (
      <DesktopComposerStatusModelPicker
        availableModels={activeComposerState?.availableModels ?? []}
        availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
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

function ChatWorkspaceChatFooter(props: ChatWorkspaceContentProps) {
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
          left={<SidebarToggleButton {...props} />}
          center={<ChatComposerCenter {...props} />}
          rightClassName={cn(
            'min-[1400px]:opacity-100',
            props.artifactDrawer.showDesktopArtifactDrawer ? 'invisible' : 'opacity-0',
          )}
          right={<ChatFooterRight {...props} />}
        />
      </div>
    </footer>
  )
}

function SidebarFooter(props: ChatWorkspaceContentProps) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
      <div className="pointer-events-auto mb-1.5">
        <SidebarToggleButton {...props} />
      </div>
    </footer>
  )
}

function ChatWorkspaceFooterArea(props: ChatWorkspaceContentProps) {
  const { showWorkspaceFooter, showSidebarFooter } = props
  if (showWorkspaceFooter) return <ChatWorkspaceChatFooter {...props} />
  if (showSidebarFooter) return <SidebarFooter {...props} />
  return null
}

export function ChatWorkspaceViewContent(props: ChatWorkspaceContentProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <ChatWorkspaceLayout {...props}>
        <ChatWorkspaceMainArea {...props} />
        <ChatWorkspaceFooterArea {...props} />
      </ChatWorkspaceLayout>
    </div>
  )
}
