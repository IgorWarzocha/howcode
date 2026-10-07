import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { getComposerRuntimeModel, QueuedPromptsCard } from '../../../../src/app/composer/index'
import type { Message } from '../../../../src/app/types'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../../../../src/app/ui/layout'
import { cn } from '../../../../src/app/utils/cn'
import { FALLBACK_APP_SETTINGS } from '../../../../src/app/workspace-shell/default-app-settings'
import { DesktopComposerStatusModelPicker } from '../../../../src/app/workspace-shell/desktop-composer-status'
import { Composer } from '../../../../src/app/workspace-shell/index'
import { WorkspaceComposerDock } from '../../../../src/app/workspace-shell/workspace-composer-dock'
import { GitOpsComposerPanel } from '../gitops/index'
import type { CodeWorkspaceContentProps } from './code-workspace-contract'
import { CodeWorkspaceMainArea } from './code-workspace-main-area'

function getReplyActivityKey(messages: readonly Message[]) {
  const replyMessageIds: string[] = []
  for (const message of messages) {
    if (message.role !== 'user') replyMessageIds.push(message.id)
  }
  return replyMessageIds.join('|')
}

function CodeSidebarToggleButton(props: CodeWorkspaceContentProps) {
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

function CodeGitOpsComposer(props: CodeWorkspaceContentProps) {
  const {
    shellState,
    projectGitState,
    parentBranchName,
    composerProjectId,
    terminalConversationId,
    diffBaseline,
    diffRenderMode,
    gitOpsReview,
    diffLoadError,
    includeUntrackedDiffFiles,
    toggleIncludeUntrackedDiffFiles,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    setComposerLayoutVersion,
    handleAction,
    handleCloseGitOpsView,
    gitOpsFileTreeVisible,
    toggleGitOpsFileTree,
    controller,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <div>
      <GitOpsComposerPanel
        appSettings={appSettings}
        project={{
          id: composerProjectId,
          gitState: projectGitState,
          parentBranchName,
          conversationId: terminalConversationId,
        }}
        diff={{
          baseline: diffBaseline,
          renderMode: diffRenderMode,
          loadError: diffLoadError,
          includeUntracked: includeUntrackedDiffFiles,
          setBaseline: onSetDiffBaseline,
          setRenderMode: onSetDiffRenderMode,
          toggleIncludeUntracked: toggleIncludeUntrackedDiffFiles,
        }}
        fileTree={{
          visible: gitOpsFileTreeVisible,
          toggle: toggleGitOpsFileTree,
        }}
        review={gitOpsReview}
        onReviewSent={handleCloseGitOpsView}
        onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
        onAction={handleAction}
        onBack={handleCloseGitOpsView}
        onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      />
    </div>
  )
}

function CodeQueuedPrompts(props: CodeWorkspaceContentProps) {
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

function CodeThreadComposer(props: CodeWorkspaceContentProps) {
  const {
    state,
    activeComposerState,
    activeThreadData,
    shellState,
    composerProjectId,
    projectGitState,
    parentBranchName,
    diffBaseline,
    terminalConversationId,
    onSetDiffBaseline,
    setComposerOverlayHeight,
    footerRef,
    handleOpenGitOpsView,
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
      messages={activeThreadData?.messages}
      isStreaming={activeThreadData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeThreadData?.messages ?? [])}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
      projectId={composerProjectId}
      projectGitState={projectGitState}
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
      onOpenGitOpsView={handleOpenGitOpsView}
      onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      onToggleTerminal={handleToggleTerminal}
      terminalVisible={state.terminalVisible}
      preferPortalModelPopover={state.activeView === 'project'}
      onListAttachmentEntries={listComposerAttachmentEntries}
      onAction={handleAction}
    />
  )
}

function CodeThreadComposerCenter(props: CodeWorkspaceContentProps) {
  const { state } = props
  if (state.activeView === 'gitops') return <CodeGitOpsComposer {...props} />
  return (
    <div className="grid gap-0">
      <CodeQueuedPrompts {...props} />
      <div>
        <CodeThreadComposer {...props} />
      </div>
    </div>
  )
}

function CodeFooterRight(props: CodeWorkspaceContentProps) {
  const {
    state,
    showDesktopTerminalDrawer,
    activeComposerState,
    composerProjectId,
    terminalConversationId,
    handleAction,
  } = props
  if (state.activeView === 'thread' && !showDesktopTerminalDrawer)
    return (
      <DesktopComposerStatusModelPicker
        availableModels={activeComposerState?.availableModels ?? []}
        availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
        composerMode="code"
        contextUsage={activeComposerState?.contextUsage ?? null}
        model={activeComposerState?.currentModel ?? null}
        projectId={composerProjectId}
        conversationId={terminalConversationId}
        thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
        onAction={handleAction}
      />
    )
  return null
}

function CodeWorkspaceThreadFooter(props: CodeWorkspaceContentProps) {
  const {
    footerRef,
    showThreadFooter,
    centerThreadFooter,
    threadFooterStyle,
    sidebarAutoHidden,
    sidebarCollapsed,
    state,
  } = props
  return (
    <footer
      ref={footerRef}
      className={cn(
        'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 pb-4',
        WORKSPACE_EDGE_PADDING_CLASS,
        centerThreadFooter || state.activeView === 'project'
          ? 'transition-[top,transform] duration-300 ease-out'
          : 'bottom-0',
        (centerThreadFooter || state.activeView === 'project') && '-translate-y-1/2',
        showThreadFooter && !centerThreadFooter && 'translate-y-0',
      )}
      style={threadFooterStyle}
    >
      <div className="pointer-events-auto grid gap-2.5">
        <WorkspaceComposerDock
          compactControls={sidebarAutoHidden || sidebarCollapsed}
          left={<CodeSidebarToggleButton {...props} />}
          center={<CodeThreadComposerCenter {...props} />}
          rightClassName={cn(
            state.activeView === 'gitops' ? 'opacity-100' : 'min-[1400px]:opacity-100 opacity-0',
          )}
          right={<CodeFooterRight {...props} />}
        />
      </div>
    </footer>
  )
}

function CodeSidebarFooter(props: CodeWorkspaceContentProps) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
      <div className="pointer-events-auto mb-1.5">
        <CodeSidebarToggleButton {...props} />
      </div>
    </footer>
  )
}

function CodeWorkspaceFooterArea(props: CodeWorkspaceContentProps) {
  const { showWorkspaceFooter, showCodeSidebarFooter } = props
  if (showWorkspaceFooter) return <CodeWorkspaceThreadFooter {...props} />
  if (showCodeSidebarFooter) return <CodeSidebarFooter {...props} />
  return null
}

export function CodeWorkspaceViewContent(props: CodeWorkspaceContentProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <CodeWorkspaceMainArea {...props} />
      <CodeWorkspaceFooterArea {...props} />
    </div>
  )
}
