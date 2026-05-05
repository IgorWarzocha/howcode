import type { AppSettings } from '../../desktop/types'
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
          <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
            {[
              ['steer', 'Steer'],
              ['followUp', 'Queue'],
              ['stop', 'Stop'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                  appSettings.composerStreamingBehavior === value &&
                    'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
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
