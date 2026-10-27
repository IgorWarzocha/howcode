import { InlineSelect } from '@howaboua/howcode-sdk/ui/inline-select'
import { useDictationProviderSelection } from '../../component-system/dictation-provider-selection'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

function DictationProviderSelect({
  controller,
  open,
  onOpenChange,
}: {
  controller: SettingsController
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { selection, providers, error } = useDictationProviderSelection()
  const options = [
    { value: 'auto', label: 'Automatic (single component)' },
    { value: 'none', label: 'None' },
    ...providers.map(({ name, contribution }) => ({
      value: name,
      label: contribution.settings?.label ?? name,
    })),
  ]
  if (!options.some(({ value }) => value === selection))
    options.push({ value: selection, label: `Unavailable: ${selection}` })
  return (
    <div className="grid gap-2">
      <InlineSelect
        id="dictation-provider"
        value={selection}
        options={options}
        open={open}
        onOpenChange={onOpenChange}
        onChange={controller.app.setDictationProvider}
      />
      {error ? <p role="status">{error}</p> : null}
    </div>
  )
}

export function buildDictationSettingsDescriptor(input: {
  controller: SettingsController
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}): SettingDescriptor {
  return {
    id: 'common.dictation-provider',
    category: 'chat',
    section: 'Composer',
    title: 'Dictation component',
    description: 'Choose voice-input controls. Select its preferred engine in component settings.',
    keywords: 'dictation microphone voice capture composer component provider',
    render: () => (
      <DictationProviderSelect
        controller={input.controller}
        open={input.openSelectId === 'dictation-provider'}
        onOpenChange={(open) => input.setOpenSelectId(open ? 'dictation-provider' : null)}
      />
    ),
  }
}
