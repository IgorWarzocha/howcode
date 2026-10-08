import { useSettingsDictationController } from '@howcode/components/dictation/ui'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import { buildModelSelectionPayload } from './helpers'
import { useSettingsDirectoryController } from './useSettingsDirectoryController'
import { useSettingsMaintenanceController } from './useSettingsMaintenanceController'

export function useSettingsController(input: {
  appSettings: AppSettings
  resolvedPiDirectory?: string | null | undefined
  onAction: DesktopActionInvoker
}) {
  const directories = {
    ...useSettingsDirectoryController(input),
    ...useSettingsMaintenanceController(input),
  }
  const dictation = useSettingsDictationController(input)
  const selectModel = (key: 'chatModel' | 'codeModel' | 'gitCommitMessageModel', id: string) =>
    void input.onAction('settings.update', buildModelSelectionPayload(key, id))

  return {
    app: {
      setComposerStreamingBehavior: (value: AppSettings['composerStreamingBehavior']) =>
        void input.onAction('settings.update', {
          key: 'composerStreamingBehavior',
          value,
        }),
      toggleHideSidebarSessionCounts: () =>
        void input.onAction('settings.update', {
          key: 'hideSidebarSessionCounts',
          value: !input.appSettings.hideSidebarSessionCounts,
        }),
      toggleHoverToBlur: () =>
        void input.onAction('settings.update', {
          key: 'hoverToBlur',
          value: !input.appSettings.hoverToBlur,
        }),
      toggleHoverToFocus: () =>
        void input.onAction('settings.update', {
          key: 'hoverToFocus',
          value: !input.appSettings.hoverToFocus,
        }),
    },
    dictation,
    models: {
      selectChatModel: (id: string) => selectModel('chatModel', id),
      selectCodeModel: (id: string) => selectModel('codeModel', id),
      selectGitCommitModel: (id: string) => selectModel('gitCommitMessageModel', id),
    },
    directories,
  }
}
