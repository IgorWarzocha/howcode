import type { SavedDiffComment } from '@howcode/native-gitops'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type { ComposerSendMode, KeybindingOverrides } from '@howcode/shared/keybindings'
import { type RefObject, useRef } from 'react'
import type {
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  NativeExtensionDialogRequest,
  NativeExtensionWidget,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
  ProjectTrustRequest,
  ThreadCustomMessageRecord,
} from '../desktop/types'
import type { Message, View } from '../types'
import { ComposerPromptSurface } from './composer-prompt-surface'

export type ComposerProps = {
  activeView: View
  model: ComposerModel | null
  contextUsage: ComposerContextUsage | null
  messages?: Message[] | undefined
  customMessages?: ThreadCustomMessageRecord[] | undefined
  availableModels: ComposerModel[]
  isStreaming: boolean
  replyActivityKey: string
  isCompacting: boolean
  isExtensionCommandRunning: boolean
  nativeExtensionWidgets: NativeExtensionWidget[]
  nativeExtensionDialogRequest: NativeExtensionDialogRequest | null
  projectTrustRequest: ProjectTrustRequest | null
  nativeSmartBtwEnabled: boolean
  thinkingLevel: ComposerThinkingLevel
  restoredQueuedPrompt: string | null
  streamingBehaviorPreference: ComposerStreamingBehavior
  availableThinkingLevels: ComposerThinkingLevel[]
  projectId: string
  chatGroupId?: string | null
  projectGitState: ProjectGitState | null
  parentBranchName?: string | null | undefined
  diffBaseline: ProjectDiffBaseline
  sessionPath: string | null
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  favoriteFolders: string[]
  showDictationButton: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  composerSendMode: ComposerSendMode
  keybindings: KeybindingOverrides
  diffRenderMode: ProjectDiffRenderMode
  diffComments: SavedDiffComment[]
  diffCommentCount: number
  diffCommentsSending: boolean
  diffCommentError: string | null
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void
  onSendDiffComments: (message?: string | null) => void
  onSelectDiffComment: (filePath: string, commentId: string) => void
  promptResetKey: number
  onOpenTakeoverTerminal: () => void
  onOpenGitOpsView: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onRestoredQueuedPromptApplied: () => void
  onToggleTerminal: () => void
  onToggleArtifacts?: (() => void) | undefined
  onOverlayHeightChange?: (height: number) => void
  showTerminalControls?: boolean
  artifactsVisible?: boolean
  artifactsAvailable?: boolean
  terminalVisible: boolean
  takeoverVisible: boolean
  preferPortalFilePicker?: boolean
  preferPortalModelPopover?: boolean
  onLayoutChange: () => void
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onAction: DesktopActionInvoker
}

export function Composer(props: ComposerProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null)

  return (
    <ComposerPromptSurface
      {...props}
      composerPanelRef={composerPanelRef}
      mainViewRef={props.mainViewRef}
      workspaceFooterRef={props.workspaceFooterRef}
      onOpenGitOps={props.onOpenGitOpsView}
    />
  )
}
