import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import { SettingsModelWorkflowControls } from './settingsModelWorkflowControls'
import type { SettingDescriptor } from './settingsTypes'

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
      id: 'models.chat',
      category: 'models',
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
    {
      id: 'models.code',
      category: 'models',
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
      id: 'models.git-commit',
      category: 'models',
      title: 'Git commit messages',
      description: 'Default settings for the GitOps view.',
      keywords: 'git commit message model provider reasoning thinking',
      render: () => (
        <SettingsModelWorkflowControls
          {...sharedProps}
          idPrefix="git-commit-models"
          selection={appSettings.gitCommitMessageModel}
          thinkingLevel={appSettings.gitCommitMessageThinkingLevel}
          onSelectModel={controller.models.selectGitCommitModel}
          onSelectThinkingLevel={(value) =>
            void onAction('settings.update', {
              key: 'gitCommitMessageThinkingLevel',
              value,
            })
          }
        />
      ),
    },
  ]
}
