import { QueuedPromptsCard } from '@howcode/composer'
import { Composer } from '@howcode/workspace'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { AppShellController } from '../../app-shell/useAppShellController'
import { WorkspaceComposerDock } from '../../components/workspace/workspace-composer-dock'
import type { AppSettings, ProjectDiffBaseline, ProjectDiffRenderMode } from '../../desktop/types'
import type { Message } from '../../types'
import { cn } from '../../utils/cn'
import { DesktopComposerStatusModelPicker } from '../code/desktop-composer-status'
import type { useQueuedPromptRestore } from '../code/useQueuedPromptRestore'
import type { ChatArtifactDrawerState } from './useChatArtifactDrawerState'

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
  customPiDirectory: null,
  initializeGitOnProjectCreate: false,
  projectDashboardEnabled: true,
  gitOpsDefaultMode: 'commit',
  gitDiffBaselineDefault: { kind: 'head' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  gitDiffIncludeUntrackedDefault: false,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  howcodeNativeAskQuestions: false,
  devUpdateBranch: false,
  piTuiTakeover: false,
  hoverToFocus: true,
  hoverToBlur: false,
  keybindings: {},
  composerSendMode: 'enter',
} satisfies AppSettings

export type ChatWorkspaceComposerProps = {
  activeComposerState: AppShellController['activeComposerState']
  activeThreadData: AppShellController['activeThreadData']
  artifactDrawer: ChatArtifactDrawerState
  composerProjectId: string
  composerPromptResetKey: number
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  draftChatGroupId: string | null
  footerRef: RefObject<HTMLElement | null>
  handleAction: AppShellController['handleAction']
  handleShowTakeoverTerminal: AppShellController['handleShowTakeoverTerminal']
  handleToggleTerminal: AppShellController['handleToggleTerminal']
  hasConversation: boolean
  hasConversationLayout: boolean
  hasPersistedChatSession: boolean
  listComposerAttachmentEntries: AppShellController['listComposerAttachmentEntries']
  mainViewRef: RefObject<HTMLElement | null>
  markRestoredQueuedPromptApplied: ReturnType<
    typeof useQueuedPromptRestore
  >['markRestoredQueuedPromptApplied']
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  pendingQueuedPromptIdsForSession: ReturnType<
    typeof useQueuedPromptRestore
  >['pendingQueuedPromptIdsForSession']
  handleEditQueuedPrompt: ReturnType<typeof useQueuedPromptRestore>['handleEditQueuedPrompt']
  handleRemoveQueuedPrompt: ReturnType<typeof useQueuedPromptRestore>['handleRemoveQueuedPrompt']
  scopedRestoredQueuedPrompt: ReturnType<
    typeof useQueuedPromptRestore
  >['scopedRestoredQueuedPrompt']
  setComposerLayoutVersion: Dispatch<SetStateAction<number>>
  setComposerOverlayHeight: Dispatch<SetStateAction<number>>
  shellState: AppShellController['shellState']
  sidebarAutoHidden: boolean
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  state: AppShellController['state']
  terminalSessionPath: string | null
  controller: AppShellController
  onToggleSidebar: () => void
}

function getReplyActivityKey(messages: readonly Message[]) {
  const replyMessageIds: string[] = []
  for (const message of messages) {
    if (message.role !== 'user') replyMessageIds.push(message.id)
  }
  return replyMessageIds.join('|')
}

function SidebarToggleButton({
  sidebarCollapsed,
  onToggleSidebar,
}: Pick<ChatWorkspaceComposerProps, 'sidebarCollapsed' | 'onToggleSidebar'>) {
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

function getChatGroupId({
  hasPersistedChatSession,
  draftChatGroupId,
  controller,
}: ChatWorkspaceComposerProps) {
  if (hasPersistedChatSession) return null
  return draftChatGroupId ?? controller.selectedChatGroupId
}

function getToggleArtifacts({ hasConversationLayout, artifactDrawer }: ChatWorkspaceComposerProps) {
  if (!hasConversationLayout) return undefined
  return artifactDrawer.toggleArtifacts
}

function ChatQueuedPrompts({
  activeComposerState,
  pendingQueuedPromptIdsForSession,
  handleEditQueuedPrompt,
  handleRemoveQueuedPrompt,
}: ChatWorkspaceComposerProps) {
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

function ChatComposer(props: ChatWorkspaceComposerProps) {
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
    artifactDrawer,
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
      composerSendMode={appSettings.composerSendMode}
      keybindings={appSettings.keybindings}
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
      onOpenSettingsView={(target) => controller.handleShowView('settings', target)}
      onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      onToggleTerminal={handleToggleTerminal}
      onToggleArtifacts={getToggleArtifacts(props)}
      artifactsAvailable={hasConversation}
      showTerminalControls={false}
      artifactsVisible={artifactDrawer.artifactsVisible}
      terminalVisible={state.terminalVisible}
      preferPortalFilePicker={!hasConversationLayout}
      preferPortalModelPopover={!hasConversationLayout}
      onListAttachmentEntries={listComposerAttachmentEntries}
      onAction={handleAction}
    />
  )
}

function ChatComposerCenter(props: ChatWorkspaceComposerProps) {
  return (
    <div className="grid gap-0">
      <ChatQueuedPrompts {...props} />
      <ChatComposer {...props} />
    </div>
  )
}

export function ChatComposerDock(props: ChatWorkspaceComposerProps) {
  const {
    sidebarAutoHidden,
    sidebarCompactMode,
    artifactDrawer,
    activeComposerState,
    composerProjectId,
    terminalSessionPath,
    handleAction,
  } = props
  return (
    <WorkspaceComposerDock
      compactControls={sidebarAutoHidden}
      left={sidebarCompactMode ? null : <SidebarToggleButton {...props} />}
      center={<ChatComposerCenter {...props} />}
      rightClassName={cn(
        'min-[1400px]:opacity-100',
        artifactDrawer.showDesktopArtifactDrawer ? 'invisible' : 'opacity-0',
      )}
      right={
        <DesktopComposerStatusModelPicker
          availableModels={activeComposerState?.availableModels ?? []}
          availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
          composerMode="chat"
          contextUsage={activeComposerState?.contextUsage ?? null}
          model={activeComposerState?.currentModel ?? null}
          projectId={composerProjectId}
          sessionPath={terminalSessionPath}
          thinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
          onAction={handleAction}
        />
      }
    />
  )
}
