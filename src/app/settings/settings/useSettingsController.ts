import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import { buildModelSelectionPayload } from './helpers'
import { useSettingsDictationController } from './useSettingsDictationController'
import { useSettingsMaintenanceController } from './useSettingsMaintenanceController'
import { useSettingsProjectController } from './useSettingsProjectController'

export function useSettingsController(input: {
  appSettings: AppSettings
  resolvedPiDirectory?: string | null | undefined
  onAction: DesktopActionInvoker
}) {
  const projects = {
    ...useSettingsProjectController(input),
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
      toggleDevUpdateBranch: () =>
        void input.onAction('settings.update', {
          key: 'devUpdateBranch',
          value: !input.appSettings.devUpdateBranch,
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
      togglePiTuiTakeover: () =>
        void input.onAction('settings.update', {
          key: 'piTuiTakeover',
          value: !input.appSettings.piTuiTakeover,
        }),
    },
    dictation: {
      deleteDictationModel: dictation.deleteDictationModel,
      dictationInstallError: dictation.dictationInstallError,
      dictationModels: dictation.dictationModels,
      dictationPendingAction: dictation.dictationPendingAction,
      installDictationModel: dictation.installDictationModel,
      setDictationMaxDurationSeconds: (value: AppSettings['dictationMaxDurationSeconds']) =>
        void input.onAction('settings.update', {
          key: 'dictationMaxDurationSeconds',
          value,
        }),
      setDictationModelId: (value: AppSettings['dictationModelId']) =>
        void input.onAction('settings.update', {
          key: 'dictationModelId',
          value,
        }),
      setShowDictationButton: (value: boolean) =>
        void input.onAction('settings.update', {
          key: 'showDictationButton',
          value,
        }),
    },
    models: {
      selectChatModel: (id: string) => selectModel('chatModel', id),
      selectCodeModel: (id: string) => selectModel('codeModel', id),
      selectGitCommitModel: (id: string) => selectModel('gitCommitMessageModel', id),
    },
    projects,
  }
}
