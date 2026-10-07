import { isToolkitExtensionEnabled, toolkitExtensions } from '@howcode/shared/toolkit-extensions'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildToolkitSettingsDescriptors(
  appSettings: AppSettings,
  onAction: DesktopActionInvoker,
): SettingDescriptor[] {
  return toolkitExtensions.map((extension) => ({
    id: `toolkit.${extension.id}`,
    category: 'howcode',
    title: extension.label,
    description: `${extension.description} Workspace UI only. Existing conversation tools are unchanged.`,
    keywords: 'toolkit plugin extension enable disable',
    render: () => (
      <ToggleBox
        checked={isToolkitExtensionEnabled(appSettings, extension.id)}
        label={extension.label}
        onClick={() => {
          const enabled = toolkitExtensions
            .filter(({ id }) =>
              id === extension.id
                ? !isToolkitExtensionEnabled(appSettings, id)
                : isToolkitExtensionEnabled(appSettings, id),
            )
            .map(({ id }) => id)
          void onAction('settings.update', { key: 'enabledToolkitExtensions', value: enabled })
        }}
      />
    ),
  }))
}
