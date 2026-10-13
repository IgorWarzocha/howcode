import { Checkbox } from '@howaboua/howcode-sdk/ui/controls'
import { isToolkitComponentEnabled, toolkitComponents } from '@howcode/shared/toolkit-components'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import type { SettingDescriptor } from './settingsTypes'

export function buildComponentSettingsDescriptors(
  appSettings: AppSettings,
  onAction: DesktopActionInvoker,
): SettingDescriptor[] {
  return toolkitComponents.map((component) => ({
    id: `component.${component.id}`,
    category: 'components',
    componentId: component.id,
    title: 'Show in workspace',
    description: `${component.description} Workspace UI only. Existing conversation tools are unchanged.`,
    keywords: 'component enable disable',
    render: () => (
      <Checkbox
        checked={isToolkitComponentEnabled(appSettings, component.id)}
        aria-label={component.label}
        onChange={() => {
          const enabled = toolkitComponents
            .filter(({ id }) =>
              id === component.id
                ? !isToolkitComponentEnabled(appSettings, id)
                : isToolkitComponentEnabled(appSettings, id),
            )
            .map(({ id }) => id)
          void onAction('settings.update', { key: 'enabledToolkitComponents', value: enabled })
        }}
      />
    ),
  }))
}
