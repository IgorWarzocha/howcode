import { Checkbox } from '@howaboua/howcode-sdk/ui/controls'
import { SegmentedControl } from '@howaboua/howcode-sdk/ui/inline-select'
import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

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
      category: 'chat',
      section: 'Composer',
      title: 'Send while the agent is responding',
      description: 'Composer follow-up messages behavior.',
      keywords: 'queue steer stop streaming responding send composer',
      render: () => (
        <div className="min-w-0 sm:min-w-[13rem]">
          <SegmentedControl
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
      id: 'common.hide-sidebar-session-counts',
      category: 'general',
      section: 'Appearance',
      title: 'Hide sidebar counts',
      description: 'Hide branch and chat count badges in the sidebar.',
      keywords: 'sidebar counts chats branch numbers badges hide',
      render: () => (
        <Checkbox
          checked={appSettings.hideSidebarSessionCounts}
          aria-label="Hide sidebar counts"
          onChange={controller.app.toggleHideSidebarSessionCounts}
        />
      ),
    },
    {
      id: 'common.hover-to-focus',
      category: 'chat',
      section: 'Composer',
      title: 'Hover to type',
      description: 'Hover to input for composer and terminal.',
      keywords: 'hover focus type composer terminal drawer input',
      render: () => (
        <Checkbox
          checked={appSettings.hoverToFocus}
          aria-label="Hover to type"
          onChange={controller.app.toggleHoverToFocus}
        />
      ),
    },
    {
      id: 'common.hover-to-blur',
      category: 'chat',
      section: 'Composer',
      title: 'Stop typing on hover leave',
      description: 'Instantly leave input when not in hover area.',
      keywords: 'hover blur leave stop typing composer terminal drawer input',
      render: () => (
        <Checkbox
          checked={appSettings.hoverToBlur}
          aria-label="Stop typing on hover leave"
          onChange={controller.app.toggleHoverToBlur}
        />
      ),
    },
  ]
}
