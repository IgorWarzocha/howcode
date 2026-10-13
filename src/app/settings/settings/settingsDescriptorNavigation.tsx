import { InlineSelect } from '@howaboua/howcode-sdk/ui/inline-select'
import {
  useInstalledNavigationPackages,
  useInstalledRendererContributions,
} from '../../component-system/installed-component-catalog'
import { classicNavigationRenderer } from '../../component-system/navigation-selection'
import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

function NavigationSelect({
  value,
  controller,
  open,
  onOpenChange,
}: {
  value: string
  controller: SettingsController
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const contributions = useInstalledRendererContributions()
  const packages = useInstalledNavigationPackages()
  const options = [
    { value: 'none', label: 'None' },
    ...Object.entries(contributions).flatMap(([name, contribution]) =>
      contribution.navigation ? [{ value: name, label: contribution.navigation.label }] : [],
    ),
    ...packages
      .filter((name) => !contributions[name]?.navigation)
      .map((name) => ({ value: name, label: name })),
  ]
  if (!options.some((option) => option.value === value))
    options.unshift({ value, label: `Unavailable: ${value}` })
  return (
    <InlineSelect
      id="navigation-renderer"
      value={value}
      options={options}
      open={open}
      onOpenChange={onOpenChange}
      onChange={controller.app.setNavigationRenderer}
    />
  )
}

export function buildNavigationSettingsDescriptor(input: {
  appSettings: AppSettings
  controller: SettingsController
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}): SettingDescriptor {
  return {
    id: 'common.navigation-renderer',
    category: 'general',
    title: 'Sidebar',
    description: 'Choose an installed navigation component, or use no sidebar.',
    keywords: 'sidebar navigation classic none component',
    render: () => (
      <NavigationSelect
        value={input.appSettings.navigationRenderer ?? classicNavigationRenderer}
        controller={input.controller}
        open={input.openSelectId === 'navigation-renderer'}
        onOpenChange={(open) => input.setOpenSelectId(open ? 'navigation-renderer' : null)}
      />
    ),
  }
}
