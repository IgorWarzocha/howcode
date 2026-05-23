import type { AppSettings } from '../../desktop/types'
import { appToneMutedClass, appTypeSmallClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingsController } from './settingsDescriptorTypes'
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
      category: 'pi-runtime',
      title: 'Send while Pi is responding',
      description: 'Composer follow-up messages behavior.',
      keywords: 'queue steer stop streaming responding send composer',
      render: () => (
        <div className="min-w-0 sm:min-w-[13rem]">
          <div
            className={`grid grid-cols-3 rounded-lg bg-[color:var(--surface-hover)] p-[3px] ${appTypeSmallClass} ${appToneMutedClass}`}
          >
            {[
              ['steer', 'Steer'],
              ['followUp', 'Queue'],
              ['stop', 'Stop'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
                  appSettings.composerStreamingBehavior === value &&
                    'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
                )}
                onClick={() =>
                  controller.setComposerStreamingBehavior(
                    value as AppSettings['composerStreamingBehavior'],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'common.howcode-native-ask-questions',
      category: 'pi-runtime',
      title: 'Ask questions tool',
      description: 'Native ask questions tool (GUI+TUI).',
      keywords: 'native extensions ask questions tool clarify',
      render: () => (
        <ToggleBox
          checked={appSettings.howcodeNativeAskQuestions}
          label="Ask questions tool"
          onClick={controller.toggleHowcodeNativeAskQuestions}
        />
      ),
    },
    {
      id: 'common.pi-tui-takeover',
      category: 'pi-runtime',
      title: 'Open in TUI',
      description: 'Always use Pi TUI takeover.',
      keywords: 'takeover terminal tui open conversations',
      render: () => (
        <ToggleBox
          checked={appSettings.piTuiTakeover}
          label="Open in TUI"
          onClick={controller.togglePiTuiTakeover}
        />
      ),
    },
    {
      id: 'common.hover-to-focus',
      category: 'pi-runtime',
      title: 'Hover to type',
      description: 'Hover to input for composer and terminal.',
      keywords: 'hover focus type composer terminal drawer input',
      render: () => (
        <ToggleBox
          checked={appSettings.hoverToFocus}
          label="Hover to type"
          onClick={controller.toggleHoverToFocus}
        />
      ),
    },
    {
      id: 'common.hover-to-blur',
      category: 'pi-runtime',
      title: 'Stop typing on hover leave',
      description: 'Instantly leave input when not in hover area.',
      keywords: 'hover blur leave stop typing composer terminal drawer input',
      render: () => (
        <ToggleBox
          checked={appSettings.hoverToBlur}
          label="Stop typing on hover leave"
          onClick={controller.toggleHoverToBlur}
        />
      ),
    },
  ]
}
