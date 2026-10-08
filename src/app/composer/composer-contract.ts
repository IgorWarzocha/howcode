import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type { ComposerSendMode, KeybindingOverrides } from '@howcode/shared/keybindings'
import type { RefObject } from 'react'
import type {
  ComposerFilePickerState,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
  DirectoryDiffBaseline,
  DirectoryGitState,
} from '../desktop/types'
import type { Message, View } from '../types'
import type { ComposerRuntimeModel } from './composer-runtime-model'

export type ComposerProps = {
  activeView: View
  composerProfile?: 'general' | 'coding'
  runtime: ComposerRuntimeModel
  messages?: Message[] | undefined
  isStreaming: boolean
  replyActivityKey: string
  streamingBehaviorPreference: ComposerStreamingBehavior
  directoryId: string
  workspaceId?: string | null
  directoryGitState: DirectoryGitState | null
  parentBranchName?: string | null | undefined
  diffBaseline: DirectoryDiffBaseline
  conversationId: string | null
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  favoriteFolders: string[]
  showDictationButton: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  composerSendMode: ComposerSendMode
  keybindings: KeybindingOverrides
  onSetDiffBaseline: (baseline: DirectoryDiffBaseline) => void
  onOpenGitOpsView: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onToggleTerminal: () => void
  onToggleArtifacts?: (() => void) | undefined
  onOverlayHeightChange?: (height: number) => void
  showTerminalControls?: boolean
  artifactsVisible?: boolean
  artifactsAvailable?: boolean
  terminalVisible: boolean
  preferPortalModelPopover?: boolean
  workspaceFooterRef: RefObject<HTMLElement | null>
  onListAttachmentEntries: (request: {
    directoryId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onAction: DesktopActionInvoker
}
