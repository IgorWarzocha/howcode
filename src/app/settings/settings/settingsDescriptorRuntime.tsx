import { Checkbox } from '@howaboua/howcode-sdk/ui/controls'
import { InlineSelect, SegmentedControl } from '@howaboua/howcode-sdk/ui/inline-select'
import type { PiThemeState, ShellPreferences } from '../../desktop/types'
import type { SetDraftShellPreference } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

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

const runtimeBooleanSettings = [
  { key: 'blockImages', title: 'Block images', description: 'Never send images to providers.' },
] as const

export function buildRuntimeSettingsDescriptors({
  draftShellPreferences,
  piTheme,
  setDraftShellPreference,
  openSelectId,
  setOpenSelectId,
}: {
  draftShellPreferences: ShellPreferences
  piTheme: PiThemeState | null
  setDraftShellPreference: SetDraftShellPreference
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}): SettingDescriptor[] {
  return [
    {
      id: 'pi-runtime.theme',
      category: 'general',
      section: 'Appearance',
      title: 'Theme',
      description: 'Colors for Howcode.',
      keywords: 'theme color json pi gui appearance howcode',
      render: () => {
        const themes =
          (piTheme?.themes.length ?? 0) > 0
            ? (piTheme?.themes ?? [])
            : [
                {
                  name: draftShellPreferences.theme,
                  label: draftShellPreferences.theme,
                  source: 'pi-json' as const,
                },
              ]
        const hasCurrentTheme = themes.some((theme) => theme.name === draftShellPreferences.theme)
        return (
          <InlineSelect
            id="pi-theme"
            value={draftShellPreferences.theme}
            options={[
              ...(hasCurrentTheme
                ? []
                : [
                    {
                      value: draftShellPreferences.theme,
                      label: `Missing theme: ${draftShellPreferences.theme}`,
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
            onChange={(value) => setDraftShellPreference('theme', value)}
          />
        )
      },
    },
    {
      id: 'pi-runtime.transport',
      category: 'chat',
      section: 'Agent behaviour',
      title: 'Transport',
      description: 'Connection mode for providers that support it.',
      keywords: 'transport sse websocket cached auto provider runtime',
      render: () => (
        <SegmentedControl
          columnsClassName="grid-cols-4"
          value={draftShellPreferences.transport}
          options={[
            { value: 'sse', label: 'SSE' },
            { value: 'websocket', label: 'WebSocket' },
            { value: 'websocket-cached', label: 'Cached WebSocket' },
            { value: 'auto', label: 'Auto' },
          ]}
          onChange={(value) => setDraftShellPreference('transport', value)}
        />
      ),
    },
    {
      id: 'pi-runtime.auto-compact',
      category: 'chat',
      section: 'Agent behaviour',
      title: 'Auto compact context',
      description: 'Switch auto compaction on or off.',
      keywords: 'auto compact context runtime',
      render: () => (
        <Checkbox
          checked={draftShellPreferences.autoCompact}
          aria-label="Auto compact context"
          onChange={() =>
            setDraftShellPreference('autoCompact', !draftShellPreferences.autoCompact)
          }
        />
      ),
    },
    ...queueModeSettings.map((setting) => ({
      id: `pi-runtime.${setting.key}`,
      category: 'chat' as const,
      section: 'Agent behaviour',
      title: setting.title,
      description: setting.description,
      keywords: 'queue drain steering follow-up mode runtime advanced',
      render: () => (
        <SegmentedControl
          columnsClassName="grid-cols-2"
          value={draftShellPreferences[setting.key]}
          options={[
            { value: 'one-at-a-time', label: 'One' },
            { value: 'all', label: 'All' },
          ]}
          onChange={(value) => setDraftShellPreference(setting.key, value)}
        />
      ),
    })),
    ...runtimeBooleanSettings.map((setting) => ({
      id: `pi-runtime.${setting.key}`,
      category: 'chat' as const,
      section: 'Agent behaviour',
      title: setting.title,
      description: setting.description,
      keywords: 'image images telemetry runtime provider',
      render: () => (
        <Checkbox
          checked={draftShellPreferences[setting.key]}
          aria-label={setting.title}
          onChange={() => setDraftShellPreference(setting.key, !draftShellPreferences[setting.key])}
        />
      ),
    })),
  ]
}
