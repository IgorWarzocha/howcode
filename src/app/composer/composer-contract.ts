import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { ComposerSendMode, KeybindingOverrides } from '@howcode/shared/keybindings'
import type { RefObject } from 'react'
import type {
  ComposerFilePickerState,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from '../desktop/types'
import type { Message, View } from '../types'
import type { ComposerRuntimeModel } from './composer-runtime-model'

export type ComposerProps = {
  activeView: View
  runtime: ComposerRuntimeModel
  messages?: Message[] | undefined
  isStreaming: boolean
  replyActivityKey: string
  restoredQueuedPrompt: string | null
  streamingBehaviorPreference: ComposerStreamingBehavior
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
  piTreeFilterMode?: PiTreeFilterMode | undefined
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
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
  preferPortalModelPopover?: boolean
  workspaceFooterRef: RefObject<HTMLElement | null>
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onAction: DesktopActionInvoker
}
