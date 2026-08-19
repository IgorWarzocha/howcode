import type { PiSettings } from '../../desktop/types'
import { settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SetDraftPiSetting } from './settingsDescriptorTypes'
import { SettingsSegmentedControl } from './settingsSegmentedControl'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

const tuiBooleanSettings = [
  { key: 'showImages', title: 'Show images', description: 'Show images in supported terminals.' },
  {
    key: 'hideThinkingBlock',
    title: 'Hide thinking blocks',
    description: 'Hide reasoning blocks in TUI output.',
  },
  {
    key: 'showHardwareCursor',
    title: 'Hardware cursor',
    description: 'Show the native terminal cursor.',
  },
  { key: 'clearOnShrink', title: 'Clear on shrink', description: 'Clear stale rows after resize.' },
  { key: 'quietStartup', title: 'Quiet startup', description: 'Hide startup diagnostics.' },
  {
    key: 'collapseChangelog',
    title: 'Condense changelog',
    description: 'Show a shorter update changelog.',
  },
] as const

const tuiNumberSettings = [
  {
    key: 'imageWidthCells',
    title: 'Image width',
    description: 'Inline image width in terminal cells.',
    min: 1,
    max: 200,
  },
  {
    key: 'editorPaddingX',
    title: 'Editor padding',
    description: 'Horizontal editor padding.',
    min: 0,
    max: 3,
  },
  {
    key: 'autocompleteMaxVisible',
    title: 'Autocomplete rows',
    description: 'Visible autocomplete rows.',
    min: 3,
    max: 20,
  },
] as const

export function buildPiTuiSettingsDescriptors({
  draftPiSettings,
  setDraftPiSetting,
}: {
  draftPiSettings: PiSettings
  setDraftPiSetting: SetDraftPiSetting
}): SettingDescriptor[] {
  return [
    {
      id: 'pi-tui.treeFilterMode',
      category: 'pi',
      dividerBefore: true,
      title: 'Session tree filter',
      description: 'What the session tree shows in the composer.',
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-2 sm:grid-cols-3"
          className="gap-[3px]"
          buttonClassName="px-2"
          value={draftPiSettings.treeFilterMode}
          options={[
            { value: 'no-tools', label: 'No tools' },
            { value: 'default', label: 'Default' },
            { value: 'user-only', label: 'User only' },
            { value: 'labeled-only', label: 'Labeled' },
            { value: 'all', label: 'All' },
          ]}
          onChange={(value) => setDraftPiSetting('treeFilterMode', value)}
        />
      ),
    },
    {
      id: 'pi-tui.doubleEscapeAction',
      category: 'pi',
      dividerBefore: true,
      title: 'Double Escape',
      description: 'Double Escape in an empty editor.',
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-3"
          value={draftPiSettings.doubleEscapeAction}
          options={[
            { value: 'tree', label: 'Tree' },
            { value: 'fork', label: 'Fork' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(value) => setDraftPiSetting('doubleEscapeAction', value)}
        />
      ),
    },
    {
      id: 'pi-tui.defaultProjectTrust',
      category: 'pi',
      dividerBefore: true,
      title: 'Project trust',
      description: 'What Pi does when a project has no saved trust decision.',
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-3"
          value={draftPiSettings.defaultProjectTrust}
          options={[
            { value: 'ask', label: 'Ask' },
            { value: 'always', label: 'Always' },
            { value: 'never', label: 'Never' },
          ]}
          onChange={(value) => setDraftPiSetting('defaultProjectTrust', value)}
        />
      ),
    },
    ...tuiBooleanSettings.map((setting) => ({
      id: `pi-tui.${setting.key}`,
      category: 'pi' as const,
      title: setting.title,
      description: setting.description,
      keywords: 'terminal tui editor cursor changelog thinking images escape',
      render: () => (
        <ToggleBox
          checked={draftPiSettings[setting.key]}
          label={setting.title}
          onClick={() => setDraftPiSetting(setting.key, !draftPiSettings[setting.key])}
        />
      ),
    })),
    ...tuiNumberSettings.map((setting) => ({
      id: `pi-tui.${setting.key}`,
      category: 'pi' as const,
      title: setting.title,
      description: setting.description,
      keywords: 'terminal tui editor autocomplete image width padding rows',
      render: () => (
        <input
          aria-label={setting.title}
          type="number"
          min={setting.min}
          max={setting.max}
          value={draftPiSettings[setting.key]}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber
            if (Number.isFinite(value)) setDraftPiSetting(setting.key, value)
          }}
          className={cn(settingsInputClass, 'w-28')}
        />
      ),
    })),
  ]
}
