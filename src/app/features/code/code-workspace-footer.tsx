import { QueuedPromptsCard } from '@howcode/composer'
import { Composer } from '@howcode/workspace'
import { FolderGit2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { GitOpsComposerPanel } from '../../components/workspace/git-ops-composer-panel'
import { WorkspaceComposerDock } from '../../components/workspace/workspace-composer-dock'
import type { Message } from '../../types'
import { cn } from '../../utils/cn'
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
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip-placement="right"
    >
      {sidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function CodeSidebarFooterButton(props: CodeWorkspaceContentProps) {
  const { sidebarCollapsed, onToggleSidebar } = props
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--panel)] text-[color:var(--muted)] opacity-70 shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip-placement="right"
    >
      {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function CodeFooterLeft(props: CodeWorkspaceContentProps) {
  const { state, sidebarCompactMode } = props
  if (state.activeView === 'project') {
    return <CodeSidebarToggleButton {...props} />
  }
  if (
    !(
      (state.activeView === 'thread' || state.activeView === 'gitops') &&
      !state.takeoverVisible &&
      !sidebarCompactMode
    )
  )
    return null
  return <CodeSidebarToggleButton {...props} />
}

function CodeGitOpsComposer(props: CodeWorkspaceContentProps) {
  const {
    shellState,
    projectGitState,
    composerProjectId,
    terminalSessionPath,
    diffBaseline,
    diffRenderMode,
    diffComments,
    diffCommentCount,
    diffCommentsSending,
    diffCommentError,
    diffLoadError,
    onSetDiffBaseline,
    onSetDiffRenderMode,
    handleSendDiffComments,
    handleSelectDiffComment,
    setComposerLayoutVersion,
    handleAction,
    handleCloseGitOpsView,
    controller,
  } = props
  const appSettings = shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <div>
      <GitOpsComposerPanel
        dictationModelId={appSettings.dictationModelId}
        dictationMaxDurationSeconds={appSettings.dictationMaxDurationSeconds}
        projectGitState={projectGitState}
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
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSendDiffComments={(message) => {
          void handleSendDiffComments(message).then((sent) => {
            if (sent) handleCloseGitOpsView()
          })
        }}
        onSelectDiffComment={handleSelectDiffComment}
        onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
        onAction={handleAction}
        onBack={handleCloseGitOpsView}
        onOpenSettingsView={(target) => controller.handleShowView('settings', target)}
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
      projectGitState={projectGitState}
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
    toggleGitOpsFileTree,
    gitOpsFileTreeVisible,
    showDesktopTerminalDrawer,
    activeComposerState,
    composerProjectId,
    terminalSessionPath,
    handleAction,
  } = props
  if (state.activeView === 'gitops' && !state.takeoverVisible)
    return (
      <button
        type="button"
        className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
        onClick={toggleGitOpsFileTree}
        aria-label={gitOpsFileTreeVisible ? 'Hide changed files' : 'Show changed files'}
        data-tooltip={gitOpsFileTreeVisible ? 'Hide changed files' : 'Show changed files'}
      >
        <FolderGit2 size={15} />
      </button>
    )
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
          compactControls={sidebarAutoHidden}
          left={<CodeFooterLeft {...props} />}
          center={<CodeThreadComposerCenter {...props} />}
          rightClassName={cn(
            state.activeView === 'gitops' ? 'opacity-100' : 'opacity-0 min-[1400px]:opacity-100',
          )}
          right={<CodeFooterRight {...props} />}
        />
      </div>
    </footer>
  )
}

function CodeSidebarFooter(props: CodeWorkspaceContentProps) {
  const { sidebarCompactMode } = props
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
      <div className="pointer-events-auto grid gap-2.5">
        <WorkspaceComposerDock
          compactControls={sidebarCompactMode}
          center={null}
          left={sidebarCompactMode ? null : <CodeSidebarFooterButton {...props} />}
        />
      </div>
    </footer>
  )
}

function CodeUtilitySidebarButton(props: CodeWorkspaceContentProps) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-10">
      <CodeSidebarFooterButton {...props} />
    </div>
  )
}

function CodeWorkspaceFooterArea(props: CodeWorkspaceContentProps) {
  const {
    showWorkspaceFooter,
    showCodeSidebarFooter,
    showUtilitySidebarButton,
    sidebarCompactMode,
  } = props
  if (showWorkspaceFooter) return <CodeWorkspaceThreadFooter {...props} />
  if (showCodeSidebarFooter) return <CodeSidebarFooter {...props} />
  if (showUtilitySidebarButton && !sidebarCompactMode)
    return <CodeUtilitySidebarButton {...props} />
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
