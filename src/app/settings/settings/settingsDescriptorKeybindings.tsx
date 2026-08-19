import { bundledKeybindings } from '@howcode/shared/keybindings'
import type { AppSettings, DesktopActionInvoker, KeybindingCommandId } from '../../desktop/types'
import { keybindingCommandHelp, keybindingOrder, readSettingsPlatform } from './settingsKeybindings'
import { SettingsShortcutRecorder } from './settingsShortcutRecorder'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect } from './settingsUi'

function buildShortcutSetting(input: {
  commandId: KeybindingCommandId
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  platform: ReturnType<typeof readSettingsPlatform>
}): SettingDescriptor {
  const binding = bundledKeybindings.find((item) => item.id === input.commandId)
  return {
    id: `keybindings.${input.commandId}`,
    category: 'shortcuts',
    title: binding?.label ?? input.commandId,
    description: keybindingCommandHelp[input.commandId],
    helpDescription: keybindingCommandHelp[input.commandId],
    keywords: `keyboard shortcut keybinding hotkey ${input.commandId}`,
    render: () => <SettingsShortcutRecorder {...input} />,
  }
}

export function buildKeybindingSettingsDescriptors({
  appSettings,
  openSelectId,
  setOpenSelectId,
  onAction,
}: {
  appSettings: AppSettings
  openSelectId: string | null
  setOpenSelectId: (value: string | null) => void
  onAction: DesktopActionInvoker
}): SettingDescriptor[] {
  const platform = readSettingsPlatform()
  return [
    {
      id: 'keybindings.composer-send-mode',
      category: 'composer',
      title: 'Composer send mode',
      description: 'Choose whether Enter sends or inserts a newline.',
      keywords: 'keyboard shortcut keybinding enter composer send newline cmd ctrl',
      render: () => (
        <InlineSelect
          id="settings-composer-send-mode"
          className="w-[13.75rem]"
          value={appSettings.composerSendMode}
          open={openSelectId === 'settings-composer-send-mode'}
          onOpenChange={(open) => setOpenSelectId(open ? 'settings-composer-send-mode' : null)}
          onChange={(value) =>
            void onAction('settings.update', {
              key: 'composerSendMode',
              value: value === 'cmd-enter' ? 'cmd-enter' : 'enter',
            })
          }
          options={[
            { value: 'enter', label: 'Enter sends', description: 'Shift+Enter inserts newline' },
            {
              value: 'cmd-enter',
              label: 'Cmd/Ctrl+Enter sends',
              description: 'Enter inserts newline',
            },
          ]}
        />
      ),
    },
    ...keybindingOrder.map((commandId) =>
      buildShortcutSetting({ commandId, appSettings, onAction, platform }),
    ),
  ]
}
