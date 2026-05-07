import { FolderGit2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useRef, useState } from 'react'
import { defaultPiSettings } from '../../../../shared/default-pi-settings'
import type { AppShellController } from '../../app-shell/useAppShellController'
import { Composer } from '../../components/workspace/composer'
import { QueuedPromptsCard } from '../../components/workspace/composer/queued-prompts-card'
import { DiffPanel } from '../../components/workspace/diff-panel'
import { GitOpsComposerPanel } from '../../components/workspace/git-ops-composer-panel'
import { WorkspaceComposerDock } from '../../components/workspace/workspace-composer-dock'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../../desktop/types'
import { useDesktopDiff } from '../../hooks/useDesktopDiff'
import type { Message } from '../../types'
import { mainPanelClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { CodeWorkspaceMainView } from './code-workspace-main-view'
import { DesktopComposerStatus } from './desktop-composer-status'
import { useDiffCommentController } from './useDiffCommentController'
import { useQueuedPromptRestore } from './useQueuedPromptRestore'
import { useWorkspaceFooterHeight } from './useWorkspaceFooterHeight'

type CodeWorkspaceViewProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

const TERMINAL_DRAWER_OFFSET = 'min(28rem, calc(100% - 2.5rem))'
const NEW_THREAD_COMPOSER_TOP = '60%'
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

type CodeWorkspaceContentProps = CodeWorkspaceViewProps &
  ReturnType<typeof useDiffCommentController> &
  ReturnType<typeof useQueuedPromptRestore> & {
    footerRef: RefObject<HTMLElement | null>
    mainViewRef: RefObject<HTMLElement | null>
    terminalDrawerInsetStyle: { right: string } | undefined
    footerInset: number
    threadFooterStyle: { right?: string; top?: string } | undefined
    showWorkspaceFooter: boolean
    showThreadFooter: boolean
    showCodeSidebarFooter: boolean
    showUtilitySidebarButton: boolean
    showDiffInMainView: boolean
    showDesktopTerminalDrawer: boolean
    centerThreadFooter: boolean
    gitOpsFileTreeVisible: boolean
    toggleGitOpsFileTree: () => void
    diffLoadError: string | null
    threadTimelineLoading: boolean
    composerLayoutVersion: number
    setComposerLayoutVersion: Dispatch<SetStateAction<number>>
    composerOverlayHeight: number
    setComposerOverlayHeight: Dispatch<SetStateAction<number>>
    composerPromptResetKey: number
    setComposerPromptResetKey: Dispatch<SetStateAction<number>>
    handleAction: AppShellController['handleAction']
    handleLoadEarlierMessages: AppShellController['handleLoadEarlierMessages']
    handleCloseGitOpsView: AppShellController['handleCloseGitOpsView']
    handleOpenGitOpsView: AppShellController['handleOpenGitOpsView']
    handleShowTakeoverTerminal: AppShellController['handleShowTakeoverTerminal']
    handleToggleTerminal: AppShellController['handleToggleTerminal']
    listComposerAttachmentEntries: AppShellController['listComposerAttachmentEntries']
    shellState: AppShellController['shellState']
    state: AppShellController['state']
    projectGitState: AppShellController['projectGitState']
  }

function getReplyActivityKey(messages: readonly Message[]) {
  return messages
    .filter((message) => message.role !== 'user')
    .map((message) => message.id)
    .join('|')
}

function CodeWorkspaceMainArea(props: CodeWorkspaceContentProps) {
  const {
    terminalDrawerInsetStyle,
    footerInset,
    mainViewRef,
    state,
    showDiffInMainView,
    composerProjectId,
    projectGitState,
    diffBaseline,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
    diffRenderMode,
    gitOpsFileTreeVisible,
    controller,
    shellState,
    activeComposerState,
    currentProjectName,
    workspaceContentClass,
    activeThreadData,
    threadTimelineLoading,
    composerLayoutVersion,
    composerOverlayHeight,
    handleAction,
    listComposerAttachmentEntries,
    sidebarCollapsed,
    sidebarCompactMode,
    onToggleSidebar,
    handleLoadEarlierMessages,
  } = props
  return (
    <div
      className="motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden px-5"
      style={{ ...terminalDrawerInsetStyle, bottom: `${footerInset}px` }}
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
        <main
          ref={mainViewRef}
          className={
            state.activeView === 'thread' ||
            state.activeView === 'code' ||
            state.activeView === 'inbox' ||
            showDiffInMainView
              ? 'min-h-0 overflow-hidden pt-1.5'
              : mainPanelClass
          }
        >
          {showDiffInMainView ? (
            <DiffPanel
              projectId={composerProjectId}
              isGitRepo={projectGitState?.isGitRepo ?? false}
              baseline={diffBaseline}
              selectedFilePath={state.selectedDiffFilePath}
              selectedCommentId={selectedDiffCommentId}
              selectedCommentJumpKey={selectedDiffCommentJumpKey}
              diffRenderMode={diffRenderMode}
              layoutMode="main"
              showFileTree={gitOpsFileTreeVisible}
              loading={controller.projectGitLoading}
            />
          ) : (
            <CodeWorkspaceMainView
              activeView={state.activeView}
              appSettings={
                shellState?.appSettings ?? {
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
                }
              }
              piSettings={shellState?.piSettings ?? defaultPiSettings}
              piTheme={shellState?.piTheme ?? null}
              archivedThreads={controller.archivedThreads}
              availableModels={activeComposerState?.availableModels ?? []}
              availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
              contextUsage={activeComposerState?.contextUsage ?? null}
              currentModel={activeComposerState?.currentModel ?? null}
              currentThinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
              isCompacting={activeComposerState?.isCompacting ?? false}
              currentProjectName={currentProjectName}
              selectedInboxThread={controller.selectedInboxThread}
              projects={controller.projects}
              selectedProjectId={controller.state.selectedProjectId}
              workspaceContentClass={workspaceContentClass}
              threadData={activeThreadData}
              threadLoading={threadTimelineLoading}
              composerLayoutVersion={composerLayoutVersion}
              composerOverlayHeight={composerOverlayHeight}
              onAction={handleAction}
              onDismissInboxThread={controller.handleDismissInboxThread}
              onListAttachmentEntries={listComposerAttachmentEntries}
              onOpenThread={controller.handleThreadOpen}
              onOpenSettingsView={() => controller.handleShowView('settings')}
              sidebarCollapsed={sidebarCollapsed}
              sidebarCompactMode={sidebarCompactMode}
              onToggleSidebar={onToggleSidebar}
              onCloseUtilityView={controller.handleCloseUtilityView}
              onLoadEarlierMessages={handleLoadEarlierMessages}
              onSetExtensionsProjectScopeActive={controller.handleSetExtensionsProjectScopeActive}
              onSetSkillsProjectScopeActive={controller.handleSetSkillsProjectScopeActive}
              onSelectProject={controller.handleProjectSelect}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function CodeSidebarToggleButton(props: CodeWorkspaceContentProps) {
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
          void handleSendDiffComments(message)
        }}
        onSelectDiffComment={handleSelectDiffComment}
        onLayoutChange={() => setComposerLayoutVersion((current: number) => current + 1)}
        onAction={handleAction}
        onBack={handleCloseGitOpsView}
        onOpenSettingsView={() => controller.handleShowView('settings')}
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
      onOpenSettingsView={() => controller.handleShowView('settings')}
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
      <DesktopComposerStatus
        contextUsage={activeComposerState?.contextUsage ?? null}
        model={activeComposerState?.currentModel ?? null}
        thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
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
        showThreadFooter ? 'transition-[top,transform] duration-300 ease-out' : 'bottom-0',
        centerThreadFooter && '-translate-y-1/2',
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

function CodeWorkspaceViewContent(props: CodeWorkspaceContentProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <CodeWorkspaceMainArea {...props} />
      <CodeWorkspaceFooterArea {...props} />
    </div>
  )
}

function isCodeUtilityView(activeView: AppShellController['state']['activeView']) {
  return (
    activeView === 'settings' ||
    activeView === 'extensions' ||
    activeView === 'skills' ||
    activeView === 'archived'
  )
}

function shouldShowDesktopTerminalDrawer(
  activeView: AppShellController['state']['activeView'],
  terminalDrawerVisible: boolean,
  terminalDrawerOverlay: boolean,
) {
  return activeView === 'thread' && terminalDrawerVisible && !terminalDrawerOverlay
}

function getCodeWorkspaceFlags(activeView: AppShellController['state']['activeView']) {
  return {
    showWorkspaceFooter: activeView === 'thread' || activeView === 'gitops',
    showThreadFooter: activeView === 'thread',
    showCodeSidebarFooter: activeView === 'code',
    showUtilitySidebarButton: isCodeUtilityView(activeView),
    showDiffInMainView: activeView === 'gitops',
  }
}

export function CodeWorkspaceView({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: CodeWorkspaceViewProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0)
  const [gitOpsFileTreeVisibilityByThread, setGitOpsFileTreeVisibilityByThread] = useState<
    Record<string, boolean>
  >({})
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0)
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)
  const mainViewRef = useRef<HTMLElement>(null)
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleCloseGitOpsView,
    handleOpenGitOpsView,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    projectGitState,
    shellState,
    state,
  } = controller
  const {
    showWorkspaceFooter,
    showThreadFooter,
    showCodeSidebarFooter,
    showUtilitySidebarButton,
    showDiffInMainView,
  } = getCodeWorkspaceFlags(state.activeView)
  const showDesktopTerminalDrawer = shouldShowDesktopTerminalDrawer(
    state.activeView,
    terminalDrawerVisible,
    terminalDrawerOverlay,
  )
  const gitOpsFileTreeStateKey = `${composerProjectId}:${terminalSessionPath ?? 'project'}`
  const gitOpsFileTreeVisible =
    gitOpsFileTreeVisibilityByThread[gitOpsFileTreeStateKey] ??
    shellState?.appSettings.gitDiffFileTreeDefaultVisible ??
    true
  const toggleGitOpsFileTree = () => {
    setGitOpsFileTreeVisibilityByThread((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }))
  }
  const { error: diffLoadError } = useDesktopDiff(
    composerProjectId,
    diffBaseline,
    showDiffInMainView && (projectGitState?.isGitRepo ?? false),
  )
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  })
  const hasThreadConversation = showThreadFooter && (activeThreadData?.messages.length ?? 0) > 0
  const hasThreadConversationLayout = hasThreadConversation || controller.activeThreadLoading
  const centerThreadFooter = showThreadFooter && !hasThreadConversationLayout
  const footerInset = showWorkspaceFooter && !centerThreadFooter ? footerHeight : 0
  const {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  } = useDiffCommentController({
    composerProjectId,
    handleAction,
    handleOpenWorktreeDiffFile,
    setComposerPromptResetKey,
    shellState,
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

  const terminalDrawerInsetStyle = showDesktopTerminalDrawer
    ? { right: TERMINAL_DRAWER_OFFSET }
    : undefined
  const threadFooterStyle = showThreadFooter
    ? {
        ...terminalDrawerInsetStyle,
        top: centerThreadFooter ? NEW_THREAD_COMPOSER_TOP : `calc(100% - ${footerHeight}px)`,
      }
    : terminalDrawerInsetStyle
  const threadTimelineLoading = state.activeView === 'thread' && controller.activeThreadLoading

  return (
    <CodeWorkspaceViewContent
      terminalDrawerInsetStyle={terminalDrawerInsetStyle}
      terminalDrawerVisible={terminalDrawerVisible}
      footerInset={footerInset}
      mainViewRef={mainViewRef}
      state={state}
      showDiffInMainView={showDiffInMainView}
      composerProjectId={composerProjectId}
      projectGitState={projectGitState}
      diffBaseline={diffBaseline}
      selectedDiffCommentId={selectedDiffCommentId}
      selectedDiffCommentJumpKey={selectedDiffCommentJumpKey}
      diffRenderMode={diffRenderMode}
      gitOpsFileTreeVisible={gitOpsFileTreeVisible}
      controller={controller}
      shellState={shellState}
      activeComposerState={activeComposerState}
      currentProjectName={currentProjectName}
      workspaceContentClass={workspaceContentClass}
      activeThreadData={activeThreadData}
      threadTimelineLoading={threadTimelineLoading}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      handleAction={handleAction}
      listComposerAttachmentEntries={listComposerAttachmentEntries}
      sidebarCollapsed={sidebarCollapsed}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
      handleLoadEarlierMessages={handleLoadEarlierMessages}
      showWorkspaceFooter={showWorkspaceFooter}
      footerRef={footerRef}
      showThreadFooter={showThreadFooter}
      centerThreadFooter={centerThreadFooter}
      threadFooterStyle={threadFooterStyle}
      sidebarAutoHidden={sidebarAutoHidden}
      terminalSessionPath={terminalSessionPath}
      diffComments={diffComments}
      diffCommentCount={diffCommentCount}
      diffCommentsSending={diffCommentsSending}
      diffCommentError={diffCommentError}
      diffLoadError={diffLoadError}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      handleSendDiffComments={handleSendDiffComments}
      handleSelectDiffComment={handleSelectDiffComment}
      setComposerLayoutVersion={setComposerLayoutVersion}
      handleCloseGitOpsView={handleCloseGitOpsView}
      handleEditQueuedPrompt={handleEditQueuedPrompt}
      handleRemoveQueuedPrompt={handleRemoveQueuedPrompt}
      pendingQueuedPromptIdsForSession={pendingQueuedPromptIdsForSession}
      setComposerOverlayHeight={setComposerOverlayHeight}
      handleShowTakeoverTerminal={handleShowTakeoverTerminal}
      handleOpenGitOpsView={handleOpenGitOpsView}
      markRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      handleToggleTerminal={handleToggleTerminal}
      showDesktopTerminalDrawer={showDesktopTerminalDrawer}
      toggleGitOpsFileTree={toggleGitOpsFileTree}
      showCodeSidebarFooter={showCodeSidebarFooter}
      showUtilitySidebarButton={showUtilitySidebarButton}
      scopedRestoredQueuedPrompt={scopedRestoredQueuedPrompt}
      composerPromptResetKey={composerPromptResetKey}
      setComposerPromptResetKey={setComposerPromptResetKey}
    />
  )
}
