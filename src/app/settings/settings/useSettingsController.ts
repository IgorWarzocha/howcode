import { useDirectorySettingsController } from '@howcode/components/working-directories/ui'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import { buildModelSelectionPayload } from './helpers'
import { useSettingsGeneralPathsController } from './useSettingsGeneralPathsController'

export function useSettingsController(input: {
  appSettings: AppSettings
  resolvedPiDirectory?: string | null | undefined
  onAction: DesktopActionInvoker
}) {
  const directories = useDirectorySettingsController(input)
  const generalPaths = useSettingsGeneralPathsController(input)

  return {
    app: {
      setNavigationRenderer: (value: string) =>
        void input.onAction('settings.update', { key: 'navigationRenderer', value }),
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
    models: {
      selectCodeModel: (id: string) =>
        void input.onAction('settings.update', buildModelSelectionPayload('codeModel', id)),
      selectChatModel: (id: string) =>
        void input.onAction('settings.update', buildModelSelectionPayload('chatModel', id)),
    },
    directories,
    generalPaths,
  }
}
