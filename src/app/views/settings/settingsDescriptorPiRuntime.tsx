import type { PiSettings, PiThemeState } from '../../desktop/types'
import { settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SetDraftPiSetting } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect, ToggleBox } from './settingsUi'

export function buildPiRuntimeSettingsDescriptors({
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
      category: 'pi-runtime',
      title: 'Theme',
      description: "Select a theme to use. Syncs with Pi's JSON files.",
      keywords: 'theme color json pi gui terminal appearance',
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
        const options = [
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
        ]

        return (
          <InlineSelect
            id="pi-theme"
            value={draftPiSettings.theme}
            options={options}
            open={openSelectId === 'pi-theme'}
            onOpenChange={(open) => setOpenSelectId(open ? 'pi-theme' : null)}
            onChange={(value) => setDraftPiSetting('theme', value)}
          />
        )
      },
    },
    {
      id: 'pi-runtime.transport',
      category: 'pi-runtime',
      title: 'Transport',
      description: 'Soon to be deprecated.',
      keywords: 'transport sse websocket auto provider runtime',
      render: () => (
        <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ['sse', 'SSE'],
            ['websocket', 'WebSocket'],
            ['auto', 'Auto'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                draftPiSettings.transport === value &&
                  'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
              )}
              onClick={() => setDraftPiSetting('transport', value as PiSettings['transport'])}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'pi-runtime.auto-compact',
      category: 'pi-runtime',
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
      category: 'pi-runtime',
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
    ...(['steeringMode', 'followUpMode'] as const).map((key) => ({
      id: `pi-runtime.${key}`,
      category: 'pi-runtime' as const,
      title: key === 'steeringMode' ? 'Steering mode' : 'Follow-up mode',
      description:
        key === 'steeringMode'
          ? 'Send one queued steer, or drain them all.'
          : 'Send one queued follow-up, or drain them all.',
      keywords: 'queue drain steering follow-up mode runtime advanced',
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ['one-at-a-time', 'One'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                draftPiSettings[key] === value &&
                  'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
              )}
              onClick={() => setDraftPiSetting(key, value as PiSettings[typeof key])}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    })),
    ...(
      [
        ['autoResizeImages', 'Auto resize images', 'Shrink images before upload.'],
        ['blockImages', 'Block images', 'Never send images to providers.'],
        ['enableInstallTelemetry', 'Install telemetry', 'Anonymous Pi version check.'],
      ] as const
    ).map(([key, title, description]) => ({
      id: `pi-runtime.${key}`,
      category: 'pi-runtime' as const,
      title,
      description,
      keywords: 'image images telemetry runtime provider',
      render: () => (
        <ToggleBox
          checked={draftPiSettings[key]}
          label={title}
          onClick={() => setDraftPiSetting(key, !draftPiSettings[key])}
        />
      ),
    })),
    ...(
      [
        ['doubleEscapeAction', 'Double Escape', 'Double Escape in an empty editor.'],
        ['showImages', 'Show images', 'Show images in supported terminals.'],
        ['hideThinkingBlock', 'Hide thinking blocks', 'Hide reasoning blocks in TUI output.'],
        ['showHardwareCursor', 'Hardware cursor', 'Show the native terminal cursor.'],
        ['clearOnShrink', 'Clear on shrink', 'Clear stale rows after resize.'],
        ['quietStartup', 'Quiet startup', 'Hide startup diagnostics.'],
        ['collapseChangelog', 'Condense changelog', 'Show a shorter update changelog.'],
      ] as const
    ).map(([key, title, description]) => ({
      id: `pi-tui.${key}`,
      category: 'pi-tui' as const,
      title,
      description,
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () =>
        key === 'doubleEscapeAction' ? (
          <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
            {[
              ['tree', 'Tree'],
              ['fork', 'Fork'],
              ['none', 'None'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                  draftPiSettings.doubleEscapeAction === value &&
                    'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
                )}
                onClick={() =>
                  setDraftPiSetting('doubleEscapeAction', value as PiSettings['doubleEscapeAction'])
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <ToggleBox
            checked={Boolean(draftPiSettings[key as keyof PiSettings])}
            label={title}
            onClick={() =>
              setDraftPiSetting(
                key as
                  | 'showImages'
                  | 'hideThinkingBlock'
                  | 'showHardwareCursor'
                  | 'clearOnShrink'
                  | 'quietStartup'
                  | 'collapseChangelog',
                !draftPiSettings[
                  key as
                    | 'showImages'
                    | 'hideThinkingBlock'
                    | 'showHardwareCursor'
                    | 'clearOnShrink'
                    | 'quietStartup'
                    | 'collapseChangelog'
                ],
              )
            }
          />
        ),
    })),
    ...(
      [
        ['imageWidthCells', 'Image width', 'Inline image width in terminal cells.', 1, 200],
        ['editorPaddingX', 'Editor padding', 'Horizontal editor padding.', 0, 3],
        ['autocompleteMaxVisible', 'Autocomplete rows', 'Visible autocomplete rows.', 3, 20],
      ] as const
    ).map(([key, title, description, min, max]) => ({
      id: `pi-tui.${key}`,
      category: 'pi-tui' as const,
      title,
      description,
      keywords: 'terminal tui editor autocomplete image width padding rows',
      render: () => (
        <input
          type="number"
          min={min}
          max={max}
          value={draftPiSettings[key]}
          onChange={(event) => {
            const nextValue = event.currentTarget.valueAsNumber
            if (Number.isFinite(nextValue)) {
              setDraftPiSetting(key, nextValue)
            }
          }}
          className={cn(settingsInputClass, 'w-28')}
        />
      ),
    })),
  ]
}
