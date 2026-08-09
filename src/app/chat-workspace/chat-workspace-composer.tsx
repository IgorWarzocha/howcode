import { getComposerRuntimeModel, QueuedPromptsCard } from '@howcode/composer'
import { Composer } from '@howcode/workspace-shell'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { DesktopComposerStatusModelPicker } from '../code-workspace/desktop-composer-status'
import type { useQueuedPromptRestore } from '../code-workspace/useQueuedPromptRestore'
import type { AppSettings, ProjectDiffBaseline } from '../desktop/types'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import { WorkspaceComposerDock } from '../workspace-shell/workspace-composer-dock'
import type { ChatWorkspaceController } from './chat-workspace-contract'
import type { ChatArtifactDrawerState } from './useChatArtifactDrawerState'

const FALLBACK_APP_SETTINGS = {
  chatModel: null,
  chatThinkingLevel: null,
  codeModel: null,
  codeThinkingLevel: null,
  gitCommitMessageModel: null,
  gitCommitMessageThinkingLevel: 'off',
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
  gitDiffBaselineDefault: { kind: 'main-branch' },
  gitDiffRenderModeDefault: 'stacked',
  gitDiffFileTreeDefaultVisible: true,
  gitDiffIncludeUntrackedDefault: false,
  projectDeletionMode: 'pi-only',
  useAgentsSkillsPaths: false,
  devUpdateBranch: false,
  piTuiTakeover: false,
  hideSidebarSessionCounts: false,
  hoverToFocus: true,
  hoverToBlur: false,
  keybindings: {},
  composerSendMode: 'enter',
} satisfies AppSettings

export type ChatWorkspaceComposerProps = {
  activeComposerState: AppShellController['composer']['state']
  activePiExtensionUiState: AppShellController['composer']['extensionUiState']
  activeThreadData: AppShellController['thread']['activeData']
  artifactDrawer: ChatArtifactDrawerState
  composerProjectId: string
  diffBaseline: ProjectDiffBaseline
  draftChatGroupId: string | null
  footerRef: RefObject<HTMLElement | null>
  handleAction: AppShellController['desktop']['handleAction']
  handleShowTakeoverTerminal: AppShellController['takeover']['show']
  handleToggleTerminal: AppShellController['terminal']['toggle']
  hasConversation: boolean
  hasConversationLayout: boolean
  hasPersistedChatSession: boolean
  listComposerAttachmentEntries: AppShellController['composer']['listAttachmentEntries']
  mainViewRef: RefObject<HTMLElement | null>
  markRestoredQueuedPromptApplied: ReturnType<
    typeof useQueuedPromptRestore
  >['markRestoredQueuedPromptApplied']
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  pendingQueuedPromptIdsForSession: ReturnType<
    typeof useQueuedPromptRestore
  >['pendingQueuedPromptIdsForSession']
  handleEditQueuedPrompt: ReturnType<typeof useQueuedPromptRestore>['handleEditQueuedPrompt']
  handleRemoveQueuedPrompt: ReturnType<typeof useQueuedPromptRestore>['handleRemoveQueuedPrompt']
  scopedRestoredQueuedPrompt: ReturnType<
    typeof useQueuedPromptRestore
  >['scopedRestoredQueuedPrompt']
  setComposerOverlayHeight: Dispatch<SetStateAction<number>>
  shellState: AppShellController['desktop']['shellState']
  sidebarAutoHidden: boolean
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  state: AppShellController['workspace']['state']
  terminalSessionPath: string | null
  controller: ChatWorkspaceController
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
  sidebarCompactMode,
  onToggleSidebar,
}: Pick<
  ChatWorkspaceComposerProps,
  'sidebarCollapsed' | 'sidebarCompactMode' | 'onToggleSidebar'
>) {
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

function getChatGroupId({
  hasPersistedChatSession,
  draftChatGroupId,
  controller,
}: ChatWorkspaceComposerProps) {
  if (hasPersistedChatSession) return null
  return draftChatGroupId ?? controller.chat.selectedGroupId
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
    activePiExtensionUiState,
    state,
    activeThreadData,
    scopedRestoredQueuedPrompt,
    shellState,
    composerProjectId,
    diffBaseline,
    terminalSessionPath,
    onSetDiffBaseline,
    setComposerOverlayHeight,
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
  const composerRuntime = getComposerRuntimeModel(activeComposerState, activePiExtensionUiState)
  return (
    <Composer
      activeView={state.activeView}
      runtime={composerRuntime}
      messages={activeThreadData?.messages}
      isStreaming={activeThreadData?.isStreaming ?? false}
      replyActivityKey={getReplyActivityKey(activeThreadData?.messages ?? [])}
      restoredQueuedPrompt={scopedRestoredQueuedPrompt}
      streamingBehaviorPreference={appSettings.composerStreamingBehavior}
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
      piTreeFilterMode={shellState?.piSettings.treeFilterMode ?? 'no-tools'}
      onSetDiffBaseline={onSetDiffBaseline}
      onOverlayHeightChange={setComposerOverlayHeight}
      workspaceFooterRef={footerRef}
      onOpenTakeoverTerminal={handleShowTakeoverTerminal}
      onOpenGitOpsView={() => {
        /* Already in chat workspace. */
      }}
      onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
      onToggleTerminal={handleToggleTerminal}
      onToggleArtifacts={getToggleArtifacts(props)}
      artifactsAvailable={hasConversation}
      showTerminalControls={false}
      artifactsVisible={artifactDrawer.artifactsVisible}
      terminalVisible={state.terminalVisible}
      takeoverVisible={state.takeoverVisible}
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
    sidebarCollapsed,
    artifactDrawer,
    activeComposerState,
    composerProjectId,
    terminalSessionPath,
    handleAction,
  } = props
  return (
    <WorkspaceComposerDock
      compactControls={sidebarAutoHidden || sidebarCollapsed}
      left={<SidebarToggleButton {...props} />}
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
