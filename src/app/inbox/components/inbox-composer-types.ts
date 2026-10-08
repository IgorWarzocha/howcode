import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type {
  AppSettings,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxChat,
} from '../../desktop/types'
import type { InboxReplyController } from '../useInboxReplyController'

export type InboxComposerOpenMenu = 'model' | 'picker' | null

export type InboxComposerModelState = {
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
}

export type InboxComposerProps = {
  appSettings: AppSettings
  isCompacting: boolean
  modelState: InboxComposerModelState
  reply: InboxReplyController
  chat: InboxChat
  onAction: DesktopActionInvoker
  onDismiss: () => void
  onListAttachmentEntries: (request: {
    directoryId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenChat: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onStartNewSession: () => void
}
