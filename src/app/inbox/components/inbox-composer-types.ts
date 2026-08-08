import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type {
  AppSettings,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
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
  thread: InboxThread
  onAction: DesktopActionInvoker
  onDismiss: () => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenThread: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onStartNewSession: () => void
}
