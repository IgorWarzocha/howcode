import type { PiSettings, PiThemeState } from '../../desktop/types'
import type { SetDraftPiSetting } from './settingsDescriptorTypes'
import { SettingsSegmentedControl } from './settingsSegmentedControl'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect, ToggleBox } from './settingsUi'

const queueModeSettings = [
  {
    key: 'steeringMode',
    title: 'Steering mode',
    description: 'Send one queued steer, or drain them all.',
  },
  {
    key: 'followUpMode',
    title: 'Follow-up mode',
    description: 'Send one queued follow-up, or drain them all.',
  },
] as const

const piBooleanSettings = [
  {
    key: 'autoResizeImages',
    title: 'Auto resize images',
    description: 'Shrink images before upload.',
  },
  { key: 'blockImages', title: 'Block images', description: 'Never send images to providers.' },
  {
    key: 'enableInstallTelemetry',
    title: 'Install telemetry',
    description: 'Anonymous Pi version check.',
  },
] as const

export function buildPiCoreSettingsDescriptors({
  draftPiSettings,
  piTheme,
  setDraftPiSetting,
  openSelectId,
  setOpenSelectId,
}: {
  draftPiSettings: PiSettings
  piTheme: PiThemeState | null
  setDraftPiSetting: SetDraftPiSetting
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}): SettingDescriptor[] {
  return [
    {
      id: 'pi-runtime.theme',
      category: 'howcode',
      title: 'Theme',
      description: 'Shared with your Pi TUI.',
      keywords: 'theme color json pi gui terminal appearance howcode tui',
      render: () => {
        const themes =
          (piTheme?.themes.length ?? 0) > 0
            ? (piTheme?.themes ?? [])
            : [
                {
                  name: draftPiSettings.theme,
                  label: draftPiSettings.theme,
                  source: 'pi-json' as const,
                },
              ]
        const hasCurrentTheme = themes.some((theme) => theme.name === draftPiSettings.theme)
        return (
          <InlineSelect
            id="pi-theme"
            value={draftPiSettings.theme}
            options={[
              ...(hasCurrentTheme
                ? []
                : [
                    {
                      value: draftPiSettings.theme,
                      label: `Missing theme: ${draftPiSettings.theme}`,
                      description:
                        'This saved theme is not available. Choose another theme to repair it.',
                    },
                  ]),
              ...themes.map((theme) => ({
                value: theme.name,
                label: theme.label,
                description:
                  theme.source === 'howcode'
                    ? 'Bundled with Howcode'
                    : theme.source === 'pi-builtin'
                      ? 'Pi built-in theme'
                      : theme.path,
              })),
            ]}
            open={openSelectId === 'pi-theme'}
            onOpenChange={(open) => setOpenSelectId(open ? 'pi-theme' : null)}
            onChange={(value) => setDraftPiSetting('theme', value)}
          />
        )
      },
    },
    {
      id: 'pi-runtime.transport',
      category: 'pi',
      title: 'Transport',
      description: 'Soon to be deprecated.',
      keywords: 'transport sse websocket auto provider runtime',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-3"
          value={draftPiSettings.transport}
          options={[
            { value: 'sse', label: 'SSE' },
            { value: 'websocket', label: 'WebSocket' },
            { value: 'auto', label: 'Auto' },
          ]}
          onChange={(value) => setDraftPiSetting('transport', value)}
        />
      ),
    },
    {
      id: 'pi-runtime.auto-compact',
      category: 'pi',
      title: 'Auto compact context',
      description: 'Switch auto compaction on or off.',
      keywords: 'auto compact context runtime',
      render: () => (
        <ToggleBox
          checked={draftPiSettings.autoCompact}
          label="Auto compact context"
          onClick={() => setDraftPiSetting('autoCompact', !draftPiSettings.autoCompact)}
        />
      ),
    },
    {
      id: 'pi-runtime.skill-commands',
      category: 'pi',
      title: 'Enable skill slash commands',
      description: 'Expose installed skills as /commands.',
      keywords: 'skills slash commands picker runtime',
      render: () => (
        <ToggleBox
          checked={draftPiSettings.enableSkillCommands}
          label="Enable skill slash commands"
          onClick={() =>
            setDraftPiSetting('enableSkillCommands', !draftPiSettings.enableSkillCommands)
          }
        />
      ),
    },
    ...queueModeSettings.map((setting) => ({
      id: `pi-runtime.${setting.key}`,
      category: 'pi' as const,
      title: setting.title,
      description: setting.description,
      keywords: 'queue drain steering follow-up mode runtime advanced',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-2"
          value={draftPiSettings[setting.key]}
          options={[
            { value: 'one-at-a-time', label: 'One' },
            { value: 'all', label: 'All' },
          ]}
          onChange={(value) => setDraftPiSetting(setting.key, value)}
        />
      ),
    })),
    ...piBooleanSettings.map((setting) => ({
      id: `pi-runtime.${setting.key}`,
      category: 'pi' as const,
      title: setting.title,
      description: setting.description,
      keywords: 'image images telemetry runtime provider',
      render: () => (
        <ToggleBox
          checked={draftPiSettings[setting.key]}
          label={setting.title}
          onClick={() => setDraftPiSetting(setting.key, !draftPiSettings[setting.key])}
        />
      ),
    })),
  ]
}
