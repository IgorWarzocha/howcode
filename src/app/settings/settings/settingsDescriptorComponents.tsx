import { isToolkitComponentEnabled, toolkitComponents } from '@howcode/shared/toolkit-components'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildComponentSettingsDescriptors(
  appSettings: AppSettings,
  onAction: DesktopActionInvoker,
): SettingDescriptor[] {
  return toolkitComponents.map((component) => ({
    id: `component.${component.id}`,
    category: 'howcode',
    title: component.label,
    description: `${component.description} Workspace UI only. Existing conversation tools are unchanged.`,
    keywords: 'component enable disable',
    render: () => (
      <ToggleBox
        checked={isToolkitComponentEnabled(appSettings, component.id)}
        label={component.label}
        onClick={() => {
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
