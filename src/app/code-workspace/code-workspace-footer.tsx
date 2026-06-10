import { QueuedPromptsCard } from '@howcode/composer'
import { GitOpsComposerPanel } from '@howcode/native-gitops'
import { Composer } from '@howcode/workspace-shell'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import { WorkspaceComposerDock } from '../workspace-shell/workspace-composer-dock'
import { FALLBACK_APP_SETTINGS } from './code-workspace-defaults'
import { CodeWorkspaceMainArea } from './code-workspace-main-area'
import type { CodeWorkspaceContentProps } from './code-workspace-view'
import { DesktopComposerStatusModelPicker } from './desktop-composer-status'

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

function CodeFooterLeft(props: CodeWorkspaceContentProps) {
  const { state } = props
  if (state.takeoverVisible) return null
  return <CodeSidebarToggleButton {...props} />
}

function CodeGitOpsComposer(props: CodeWorkspaceContentProps) {
  const {
    shellState,
    projectGitState,
    parentBranchName,
    composerProjectId,
    terminalSessionPath,
    diffBaseline,
    diffRenderMode,
    diffComments,
    diffCommentCount,
    diffCommentsSending,
    diffCommentError,
    diffLoadError,
    hasPendingDiffComments,
    includeUntrackedDiffFiles,
    toggleIncludeUntrackedDiffFiles,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    handleSendDiffComments,
    handleDiscardDiffComments,
    handleSelectDiffComment,
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
        dictationModelId={appSettings.dictationModelId}
        dictationMaxDurationSeconds={appSettings.dictationMaxDurationSeconds}
        projectGitState={projectGitState}
        parentBranchName={parentBranchName}
        projectId={composerProjectId}
        sessionPath={terminalSessionPath}
        showDictationButton={appSettings.showDictationButton}
        appSettings={appSettings}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        diffComments={diffComments}
        diffCommentCount={diffCommentCount}
        diffCommentsSending={diffCommentsSending}
        diffCommentError={diffCommentError}
        diffLoadError={diffLoadError}
        includeUntracked={includeUntrackedDiffFiles}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onToggleIncludeUntracked={toggleIncludeUntrackedDiffFiles}
        onSendDiffComments={(message) => {
          void handleSendDiffComments(message).then((sent) => {
            if (sent) handleCloseGitOpsView()
          })
        }}
        onSelectDiffComment={handleSelectDiffComment}
        hasPendingDiffComments={hasPendingDiffComments}
        onDiscardDiffComments={handleDiscardDiffComments}
        onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
        onAction={handleAction}
        onBack={handleCloseGitOpsView}
        onOpenSettingsView={(target) => controller.handleShowView('settings', target)}
        gitOpsFileTreeVisible={gitOpsFileTreeVisible}
        onToggleGitOpsFileTree={toggleGitOpsFileTree}
      />
    </div>
  )
}

function CodeQueuedPrompts(props: CodeWorkspaceContentProps) {
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

function CodeThreadComposer(props: CodeWorkspaceContentProps) {
  const {
    state,
    activeComposerState,
    activeThreadData,
    scopedRestoredQueuedPrompt,
    shellState,
    composerProjectId,
    projectGitState,
    parentBranchName,
    diffBaseline,
    terminalSessionPath,
    diffRenderMode,
    diffComments,
    diffCommentCount,
    diffCommentsSending,
    diffCommentError,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    handleSendDiffComments,
    handleSelectDiffComment,
    composerPromptResetKey,
    setComposerLayoutVersion,
    setComposerOverlayHeight,
    mainViewRef,
    footerRef,
    handleShowTakeoverTerminal,
    handleOpenGitOpsView,
    controller,
    markRestoredQueuedPromptApplied,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    handleAction,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <Composer
      activeView={state.activeView}
      model={activeComposerState?.currentModel ?? null}
      contextUsage={activeComposerState?.contextUsage ?? null}
      messages={activeThreadData?.messages}
      customMessages={activeThreadData?.customMessages}
      availableModels={activeComposerState?.availableModels ?? []}
      isStreaming={activeThreadData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeThreadData?.messages ?? [])}
      isCompacting={activeComposerState?.isCompacting ?? false}
      isExtensionCommandRunning={activeComposerState?.isExtensionCommandRunning ?? false}
      nativeExtensionWidgets={activeComposerState?.nativeExtensionWidgets ?? []}
      nativeExtensionStatuses={activeComposerState?.nativeExtensionStatuses ?? []}
      nativeExtensionDialogRequest={activeComposerState?.nativeExtensionDialogRequest ?? null}
      projectTrustRequest={activeComposerState?.projectTrustRequest ?? null}
      nativeSmartBtwEnabled={appSettings.howcodeNativeSmartBtw}
      thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
      restoredQueuedPrompt={scopedRestoredQueuedPrompt}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
      availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
      projectId={composerProjectId}
      projectGitState={projectGitState}
      parentBranchName={parentBranchName}
      diffBaseline={diffBaseline}
      sessionPath={terminalSessionPath}
      dictationModelId={appSettings.dictationModelId}
      dictationMaxDurationSeconds={appSettings.dictationMaxDurationSeconds}
      favoriteFolders={appSettings.favoriteFolders}
      showDictationButton={appSettings.showDictationButton}
      hoverToFocus={appSettings.hoverToFocus}
      hoverToBlur={appSettings.hoverToBlur}
      composerSendMode={appSettings.composerSendMode}
      keybindings={appSettings.keybindings}
      diffRenderMode={diffRenderMode}
      diffComments={diffComments}
      diffCommentCount={diffCommentCount}
      diffCommentsSending={diffCommentsSending}
      diffCommentError={diffCommentError}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      onSendDiffComments={(message) => {
        void handleSendDiffComments(message)
      }}
      onSelectDiffComment={handleSelectDiffComment}
      promptResetKey={composerPromptResetKey}
      onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
      onOverlayHeightChange={setComposerOverlayHeight}
      mainViewRef={mainViewRef}
      workspaceFooterRef={footerRef}
      onOpenTakeoverTerminal={handleShowTakeoverTerminal}
      onOpenGitOpsView={handleOpenGitOpsView}
      onOpenSettingsView={(target) => controller.handleShowView('settings', target)}
      onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      onToggleTerminal={handleToggleTerminal}
      terminalVisible={state.terminalVisible}
      takeoverVisible={state.takeoverVisible}
      preferPortalFilePicker={state.activeView === 'project'}
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
    terminalSessionPath,
    handleAction,
  } = props
  if (state.activeView === 'thread' && !state.takeoverVisible && !showDesktopTerminalDrawer)
    return (
      <DesktopComposerStatusModelPicker
        availableModels={activeComposerState?.availableModels ?? []}
        availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
        composerMode="code"
        contextUsage={activeComposerState?.contextUsage ?? null}
        model={activeComposerState?.currentModel ?? null}
        projectId={composerProjectId}
        sessionPath={terminalSessionPath}
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
        'motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 px-5 pb-4',
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
          left={<CodeFooterLeft {...props} />}
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
