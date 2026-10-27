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
  models: { selectModel: (id: string) => void }
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
      section: 'Providers',
      title: 'AI services',
      description: 'Connect the services you use for AI models.',
      layout: 'rows',
      keywords:
        'login logout authentication oauth credentials provider accounts api key subscription',
      render: () => <SettingsAiServices />,
    },
    {
      id: 'models.defaults',
      category: 'chat',
      section: 'Agent behaviour',
      title: 'Model defaults',
      description: 'Default model and thinking level for new chats.',
      keywords: 'chat model provider reasoning thinking',
      render: () => (
        <SettingsModelWorkflowControls
          {...sharedProps}
          idPrefix="chat-models"
          selection={appSettings.defaultModel}
          thinkingLevel={appSettings.defaultThinkingLevel}
          allowDefaultThinking
          onSelectModel={controller.models.selectModel}
          onSelectThinkingLevel={(value) =>
            void onAction(
              'settings.update',
              value === null
                ? { key: 'defaultThinkingLevel', reset: true }
                : { key: 'defaultThinkingLevel', value },
            )
          }
        />
      ),
    },
  ]
}
