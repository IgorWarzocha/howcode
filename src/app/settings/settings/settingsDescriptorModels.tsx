import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from '../../desktop/types'
import { SettingsAiServices } from './settingsAiServices'
import { SettingsModelWorkflowControls } from './settingsModelWorkflowControls'
import type { SettingDescriptor } from './settingsTypes'

type SettingsController = {
  models: { selectChatModel: (id: string) => void; selectCodeModel: (id: string) => void }
}

export function buildModelSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  openSelectId,
  setOpenSelectId,
  onAction,
}: {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  controller: SettingsController
  openSelectId: string | null
  setOpenSelectId: (value: string | null) => void
  onAction: DesktopActionInvoker
}): SettingDescriptor[] {
  const sharedProps = {
    availableModels,
    availableThinkingLevels,
    currentModel,
    openSelectId,
    setOpenSelectId,
  }
  return [
    {
      id: 'general.ai-services',
      category: 'general',
      title: 'AI services',
      description: 'Connect the services you use for AI models.',
      layout: 'rows',
      keywords:
        'login logout authentication oauth credentials provider accounts api key subscription',
      render: () => <SettingsAiServices />,
    },
    {
      id: 'models.code',
      category: 'chat',
      title: 'Code',
      description: 'Default settings for the Code view.',
      keywords: 'code model provider reasoning thinking composer',
      render: () => (
        <SettingsModelWorkflowControls
          {...sharedProps}
          idPrefix="code-models"
          selection={appSettings.codeModel}
          thinkingLevel={appSettings.codeThinkingLevel}
          allowDefaultThinking
          onSelectModel={controller.models.selectCodeModel}
          onSelectThinkingLevel={(value) =>
            void onAction(
              'settings.update',
              value === null
                ? { key: 'codeThinkingLevel', reset: true }
                : { key: 'codeThinkingLevel', value },
            )
          }
        />
      ),
    },

    {
      id: 'models.chat',
      category: 'chat',
      title: 'Chat',
      description: 'Default settings for the Chat view.',
      keywords: 'chat model provider reasoning thinking',
      render: () => (
        <SettingsModelWorkflowControls
          {...sharedProps}
          idPrefix="chat-models"
          selection={appSettings.chatModel}
          thinkingLevel={appSettings.chatThinkingLevel}
          allowDefaultThinking
          onSelectModel={controller.models.selectChatModel}
          onSelectThinkingLevel={(value) =>
            void onAction(
              'settings.update',
              value === null
                ? { key: 'chatThinkingLevel', reset: true }
                : { key: 'chatThinkingLevel', value },
            )
          }
        />
      ),
    },
  ]
}
