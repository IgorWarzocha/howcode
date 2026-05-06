import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect } from './settingsUi'

type ModelSettingsSelection = AppSettings['chatModel']

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
  setOpenSelectId: Dispatch<SetStateAction<string | null>>
  onAction: DesktopActionInvoker
}): SettingDescriptor[] {
  const modelProviders = [...new Set(availableModels.map((model) => model.provider))].sort()
  const allThinkingLevels: ComposerThinkingLevel[] = [
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
  ]
  const getSelectedWorkflowModel = (selection: ModelSettingsSelection) =>
    selection
      ? (availableModels.find(
          (model) => model.provider === selection.provider && model.id === selection.id,
        ) ?? null)
      : currentModel
  const getWorkflowThinkingLevels = (selection: ModelSettingsSelection) => {
    const selectedModel = getSelectedWorkflowModel(selection)
    if (!selection) {
      return availableThinkingLevels
    }

    return selectedModel?.reasoning ? allThinkingLevels : (['off'] as ComposerThinkingLevel[])
  }
  const selectFirstProviderModel = (
    provider: string | null,
    selection: ModelSettingsSelection,
    selectModel: (id: string) => void,
  ) => {
    if (!provider) {
      selectModel('composer-default')
      return
    }

    if (selection?.provider === provider) {
      return
    }

    const firstModel = availableModels.find((model) => model.provider === provider)
    if (firstModel) {
      selectModel(`${firstModel.provider}/${firstModel.id}`)
    }
  }
  const buildProviderOptions = (
    id: string,
    selection: ModelSettingsSelection,
    selectModel: (id: string) => void,
  ) => (
    <InlineSelect
      id={id}
      value={selection?.provider ?? 'composer-default'}
      open={openSelectId === id}
      options={[
        { value: 'composer-default', label: 'Composer default' },
        ...modelProviders.map((provider) => ({
          value: provider,
          label: provider,
        })),
      ]}
      onOpenChange={(open) => setOpenSelectId(open ? id : null)}
      onChange={(value) =>
        selectFirstProviderModel(
          value === 'composer-default' ? null : value,
          selection,
          selectModel,
        )
      }
    />
  )
  const buildModelOptions = (
    id: string,
    selection: ModelSettingsSelection,
    selectModel: (id: string) => void,
  ) => {
    const providerModels = selection
      ? availableModels.filter((model) => model.provider === selection.provider)
      : availableModels

    return (
      <InlineSelect
        id={id}
        value={selection ? `${selection.provider}/${selection.id}` : 'composer-default'}
        open={openSelectId === id}
        options={[
          {
            value: 'composer-default',
            label: 'Composer default',
            description: currentModel ? currentModel.name : undefined,
          },
          ...providerModels.map((model) => ({
            value: `${model.provider}/${model.id}`,
            label: model.name,
            description: `${model.provider}/${model.id}`,
          })),
        ]}
        onOpenChange={(open) => setOpenSelectId(open ? id : null)}
        onChange={selectModel}
      />
    )
  }
  const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
    off: 'Off',
    minimal: 'Minimal',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra high',
  }
  const renderThinkingSelector = (
    id: string,
    value: ComposerThinkingLevel | null,
    levels: ComposerThinkingLevel[],
    onChange: (value: ComposerThinkingLevel | null) => void,
    allowDefault = false,
  ) => (
    <InlineSelect
      id={id}
      value={
        value && levels.includes(value)
          ? value
          : allowDefault
            ? 'composer-default'
            : (levels[0] ?? 'off')
      }
      open={openSelectId === id}
      options={[
        ...(allowDefault ? [{ value: 'composer-default', label: 'Composer default' }] : []),
        ...levels.map((level) => ({
          value: level,
          label: thinkingLevelLabels[level],
        })),
      ]}
      onOpenChange={(open) => setOpenSelectId(open ? id : null)}
      onChange={(nextValue) =>
        onChange(nextValue === 'composer-default' ? null : (nextValue as ComposerThinkingLevel))
      }
    />
  )
  const renderModelWorkflowControls = (
    idPrefix: string,
    selection: ModelSettingsSelection,
    thinkingLevel: ComposerThinkingLevel | null,
    selectModel: (id: string) => void,
    selectThinkingLevel: (value: ComposerThinkingLevel | null) => void,
    allowDefaultThinking = false,
  ) => (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 xl:w-auto xl:grid-cols-3 xl:[--settings-model-select-width:10.4rem]">
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full xl:[&_[data-inline-select-root]]:w-[var(--settings-model-select-width)]">
          {buildProviderOptions(`${idPrefix}-provider`, selection, selectModel)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full xl:[&_[data-inline-select-root]]:w-[var(--settings-model-select-width)]">
          {buildModelOptions(`${idPrefix}-model`, selection, selectModel)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full xl:[&_[data-inline-select-root]]:w-[var(--settings-model-select-width)]">
          {renderThinkingSelector(
            `${idPrefix}-thinking`,
            thinkingLevel,
            getWorkflowThinkingLevels(selection),
            selectThinkingLevel,
            allowDefaultThinking,
          )}
        </div>
      </div>
    </div>
  )

  return [
    {
      id: 'models.chat',
      category: 'models',
      title: 'Chat',
      description: 'Default settings for the Chat view.',
      keywords: 'chat model provider reasoning thinking',
      render: () =>
        renderModelWorkflowControls(
          'chat-models',
          appSettings.chatModel,
          appSettings.chatThinkingLevel,
          controller.selectChatModel,
          (value) =>
            void onAction(
              'settings.update',
              value === null
                ? { key: 'chatThinkingLevel', reset: true }
                : { key: 'chatThinkingLevel', value },
            ),
          true,
        ),
    },
    {
      id: 'models.code',
      category: 'models',
      title: 'Code',
      description: 'Default settings for the Code view.',
      keywords: 'code model provider reasoning thinking composer',
      render: () =>
        renderModelWorkflowControls(
          'code-models',
          appSettings.codeModel,
          appSettings.codeThinkingLevel,
          controller.selectCodeModel,
          (value) =>
            void onAction(
              'settings.update',
              value === null
                ? { key: 'codeThinkingLevel', reset: true }
                : { key: 'codeThinkingLevel', value },
            ),
          true,
        ),
    },
    {
      id: 'models.git-commit',
      category: 'models',
      title: 'Git commit messages',
      description: 'Default settings for the GitOps view.',
      keywords: 'git commit message model provider reasoning thinking',
      render: () =>
        renderModelWorkflowControls(
          'git-commit-models',
          appSettings.gitCommitMessageModel,
          appSettings.gitCommitMessageThinkingLevel,
          controller.selectGitCommitModel,
          (value) =>
            void onAction('settings.update', {
              key: 'gitCommitMessageThinkingLevel',
              value,
            }),
        ),
    },
    {
      id: 'models.skill-creator',
      category: 'models',
      title: 'Skill creator',
      description: 'Default settings for the built-in skill creator.',
      keywords: 'skill creator model provider reasoning thinking',
      render: () =>
        renderModelWorkflowControls(
          'skill-creator-models',
          appSettings.skillCreatorModel,
          appSettings.skillCreatorThinkingLevel,
          controller.selectSkillCreatorModel,
          (value) =>
            void onAction('settings.update', {
              key: 'skillCreatorThinkingLevel',
              value,
            }),
        ),
    },
  ]
}
