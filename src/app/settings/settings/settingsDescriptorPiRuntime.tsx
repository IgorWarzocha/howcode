import type { PiSettings, PiThemeState } from '../../desktop/types'
import { appToneMutedClass, appTypeSmallClass, settingsInputClass } from '../../ui/classes'
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
      category: 'pi',
      title: 'Transport',
      description: 'Soon to be deprecated.',
      keywords: 'transport sse websocket auto provider runtime',
      render: () => (
        <div
          className={`grid grid-cols-3 rounded-lg bg-[color:var(--surface-hover)] p-[3px] ${appTypeSmallClass} ${appToneMutedClass}`}
        >
          {[
            ['sse', 'SSE'],
            ['websocket', 'WebSocket'],
            ['auto', 'Auto'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                draftPiSettings.transport === value &&
                  'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
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
    ...(['steeringMode', 'followUpMode'] as const).map((key) => ({
      id: `pi-runtime.${key}`,
      category: 'pi' as const,
      title: key === 'steeringMode' ? 'Steering mode' : 'Follow-up mode',
      description:
        key === 'steeringMode'
          ? 'Send one queued steer, or drain them all.'
          : 'Send one queued follow-up, or drain them all.',
      keywords: 'queue drain steering follow-up mode runtime advanced',
      render: () => (
        <div
          className={`grid grid-cols-2 rounded-lg bg-[color:var(--surface-hover)] p-[3px] ${appTypeSmallClass} ${appToneMutedClass}`}
        >
          {[
            ['one-at-a-time', 'One'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                draftPiSettings[key] === value &&
                  'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
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
      category: 'pi' as const,
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
        ['treeFilterMode', 'Session tree filter', 'What the session tree shows in the composer.'],
        ['doubleEscapeAction', 'Double Escape', 'Double Escape in an empty editor.'],
        [
          'defaultProjectTrust',
          'Project trust',
          'What Pi does when a project has no saved trust decision.',
        ],
        ['showImages', 'Show images', 'Show images in supported terminals.'],
        ['hideThinkingBlock', 'Hide thinking blocks', 'Hide reasoning blocks in TUI output.'],
        ['showHardwareCursor', 'Hardware cursor', 'Show the native terminal cursor.'],
        ['clearOnShrink', 'Clear on shrink', 'Clear stale rows after resize.'],
        ['quietStartup', 'Quiet startup', 'Hide startup diagnostics.'],
        ['collapseChangelog', 'Condense changelog', 'Show a shorter update changelog.'],
      ] as const
    ).map(([key, title, description]) => ({
      id: `pi-tui.${key}`,
      category: 'pi' as const,
      dividerBefore:
        key === 'treeFilterMode' || key === 'doubleEscapeAction' || key === 'defaultProjectTrust',
      title,
      description,
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () =>
        key === 'treeFilterMode' ? (
          <div
            className={`grid grid-cols-2 gap-[3px] rounded-lg bg-[color:var(--surface-hover)] p-[3px] sm:grid-cols-3 ${appTypeSmallClass} ${appToneMutedClass}`}
          >
            {(
              [
                ['no-tools', 'No tools'],
                ['default', 'Default'],
                ['user-only', 'User only'],
                ['labeled-only', 'Labeled'],
                ['all', 'All'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-md px-2 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                  draftPiSettings.treeFilterMode === value &&
                    'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
                )}
                onClick={() =>
                  setDraftPiSetting('treeFilterMode', value as PiSettings['treeFilterMode'])
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : key === 'doubleEscapeAction' ? (
          <div
            className={`grid grid-cols-3 rounded-lg bg-[color:var(--surface-hover)] p-[3px] ${appTypeSmallClass} ${appToneMutedClass}`}
          >
            {[
              ['tree', 'Tree'],
              ['fork', 'Fork'],
              ['none', 'None'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                  draftPiSettings.doubleEscapeAction === value &&
                    'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
                )}
                onClick={() =>
                  setDraftPiSetting('doubleEscapeAction', value as PiSettings['doubleEscapeAction'])
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : key === 'defaultProjectTrust' ? (
          <div
            className={`grid grid-cols-3 rounded-lg bg-[color:var(--surface-hover)] p-[3px] ${appTypeSmallClass} ${appToneMutedClass}`}
          >
            {[
              ['ask', 'Ask'],
              ['always', 'Always'],
              ['never', 'Never'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                  draftPiSettings.defaultProjectTrust === value &&
                    'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
                )}
                onClick={() =>
                  setDraftPiSetting(
                    'defaultProjectTrust',
                    value as PiSettings['defaultProjectTrust'],
                  )
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
      category: 'pi' as const,
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
