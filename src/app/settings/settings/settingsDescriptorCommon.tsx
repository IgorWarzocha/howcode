import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import { SettingsSegmentedControl } from './settingsSegmentedControl'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildCommonSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    {
      id: 'common.streaming-behavior',
      category: 'composer',
      title: 'Send while Pi is responding',
      description: 'Composer follow-up messages behavior.',
      keywords: 'queue steer stop streaming responding send composer',
      render: () => (
        <div className="min-w-0 sm:min-w-[13rem]">
          <SettingsSegmentedControl
            columnsClassName="grid-cols-3"
            value={appSettings.composerStreamingBehavior}
            options={[
              { value: 'steer', label: 'Steer' },
              { value: 'followUp', label: 'Queue' },
              { value: 'stop', label: 'Stop' },
            ]}
            onChange={controller.app.setComposerStreamingBehavior}
          />
        </div>
      ),
    },
    {
      id: 'common.pi-tui-takeover',
      category: 'howcode',
      title: 'Open in TUI',
      description: 'Always use Pi TUI takeover.',
      keywords: 'takeover terminal tui open conversations',
      render: () => (
        <ToggleBox
          checked={appSettings.piTuiTakeover}
          label="Open in TUI"
          onClick={controller.app.togglePiTuiTakeover}
        />
      ),
    },
    {
      id: 'common.hide-sidebar-session-counts',
      category: 'howcode',
      title: 'Hide sidebar counts',
      description: 'Hide branch and session count badges in the sidebar.',
      keywords: 'sidebar counts sessions branch numbers badges hide',
      render: () => (
        <ToggleBox
          checked={appSettings.hideSidebarSessionCounts}
          label="Hide sidebar counts"
          onClick={controller.app.toggleHideSidebarSessionCounts}
        />
      ),
    },
    {
      id: 'common.hover-to-focus',
      category: 'composer',
      title: 'Hover to type',
      description: 'Hover to input for composer and terminal.',
      keywords: 'hover focus type composer terminal drawer input',
      render: () => (
        <ToggleBox
          checked={appSettings.hoverToFocus}
          label="Hover to type"
          onClick={controller.app.toggleHoverToFocus}
        />
      ),
    },
    {
      id: 'common.hover-to-blur',
      category: 'composer',
      title: 'Stop typing on hover leave',
      description: 'Instantly leave input when not in hover area.',
      keywords: 'hover blur leave stop typing composer terminal drawer input',
      render: () => (
        <ToggleBox
          checked={appSettings.hoverToBlur}
          label="Stop typing on hover leave"
          onClick={controller.app.toggleHoverToBlur}
        />
      ),
    },
  ]
}
