import type { AppSettings, ComposerModel, ComposerThinkingLevel } from '../../desktop/types'
import { InlineSelect } from './settingsUi'

type ModelSettingsSelection = AppSettings['chatModel']

const allThinkingLevels: ComposerThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
}

export function SettingsModelWorkflowControls({
  allowDefaultThinking = false,
  availableModels,
  availableThinkingLevels,
  currentModel,
  idPrefix,
  onSelectModel,
  onSelectThinkingLevel,
  openSelectId,
  selection,
  setOpenSelectId,
  thinkingLevel,
}: {
  allowDefaultThinking?: boolean | undefined
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  idPrefix: string
  onSelectModel: (id: string) => void
  onSelectThinkingLevel: (value: ComposerThinkingLevel | null) => void
  openSelectId: string | null
  selection: ModelSettingsSelection
  setOpenSelectId: (value: string | null) => void
  thinkingLevel: ComposerThinkingLevel | null
}) {
  const providers = [...new Set(availableModels.map((model) => model.provider))].toSorted()
  const selectedModel = selection
    ? (availableModels.find(
        (model) => model.provider === selection.provider && model.id === selection.id,
      ) ?? null)
    : currentModel
  const thinkingLevels = selection
    ? selectedModel?.reasoning
      ? allThinkingLevels
      : (['off'] as ComposerThinkingLevel[])
    : availableThinkingLevels
  const providerModels = selection
    ? availableModels.filter((model) => model.provider === selection.provider)
    : availableModels

  const selectProvider = (provider: string) => {
    if (provider === 'composer-default') {
      onSelectModel('composer-default')
      return
    }
    if (selection?.provider === provider) return
    const firstModel = availableModels.find((model) => model.provider === provider)
    if (firstModel) onSelectModel(`${firstModel.provider}/${firstModel.id}`)
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.75rem] gap-1.5 sm:w-auto sm:[--settings-model-select-width:10.4rem]">
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full sm:[&_[data-inline-select-root]]:w-[var(--settings-model-select-width)]">
          <InlineSelect
            id={`${idPrefix}-provider`}
            value={selection?.provider ?? 'composer-default'}
            open={openSelectId === `${idPrefix}-provider`}
            options={[
              { value: 'composer-default', label: 'Composer default' },
              ...providers.map((provider) => ({ value: provider, label: provider })),
            ]}
            onOpenChange={(open) => setOpenSelectId(open ? `${idPrefix}-provider` : null)}
            onChange={selectProvider}
          />
        </div>
      </div>
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full sm:[&_[data-inline-select-root]]:w-[var(--settings-model-select-width)]">
          <InlineSelect
            id={`${idPrefix}-model`}
            value={selection ? `${selection.provider}/${selection.id}` : 'composer-default'}
            open={openSelectId === `${idPrefix}-model`}
            options={[
              {
                value: 'composer-default',
                label: 'Composer default',
                description: currentModel?.name,
              },
              ...providerModels.map((model) => ({
                value: `${model.provider}/${model.id}`,
                label: model.name,
                description: `${model.provider}/${model.id}`,
              })),
            ]}
            onOpenChange={(open) => setOpenSelectId(open ? `${idPrefix}-model` : null)}
            onChange={onSelectModel}
            menuAlign="right"
          />
        </div>
      </div>
      <div className="min-w-0">
        <div className="[&_[data-inline-select-root]]:w-full sm:[&_[data-inline-select-root]]:w-[7.75rem]">
          <InlineSelect
            id={`${idPrefix}-thinking`}
            value={
              thinkingLevel && thinkingLevels.includes(thinkingLevel)
                ? thinkingLevel
                : allowDefaultThinking
                  ? 'composer-default'
                  : (thinkingLevels[0] ?? 'off')
            }
            open={openSelectId === `${idPrefix}-thinking`}
            options={[
              ...(allowDefaultThinking
                ? [{ value: 'composer-default', label: 'Composer default' }]
                : []),
              ...thinkingLevels.map((level) => ({
                value: level,
                label: thinkingLevelLabels[level],
              })),
            ]}
            onOpenChange={(open) => setOpenSelectId(open ? `${idPrefix}-thinking` : null)}
            onChange={(value) =>
              onSelectThinkingLevel(
                value === 'composer-default' ? null : (value as ComposerThinkingLevel),
              )
            }
          />
        </div>
      </div>
    </div>
  )
}
