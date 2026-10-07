import { CodingWorkspacePreferencesProvider } from '@howcode/plugins/coding/ui/views'
import { DictationDraftInput } from '@howcode/plugins/dictation/ui'
import { AppShellLayout } from './app-shell/app-shell-layout'
import { useAppShellController } from './app-shell/useAppShellController'
import { usePiGuiTheme } from './app-shell/usePiGuiTheme'
import { DraftInputContributionContext } from './composer/draft-input-context'
import { ToolkitSettingsContext } from './extensions/toolkit-context'
import { isWorkspaceViewEnabled } from './extensions/toolkit-plugins'

export function AppShell() {
  const controller = useAppShellController()
  usePiGuiTheme(controller.desktop.shellState?.piTheme)
  const selectedView = controller.workspace.state.activeView
  const activeView = isWorkspaceViewEnabled(
    controller.desktop.shellState?.appSettings,
    selectedView,
  )
    ? selectedView
    : 'chat'
  const retainCodingPreferences =
    activeView !== 'chat' &&
    activeView !== 'claw' &&
    activeView !== 'work' &&
    activeView !== 'automations'
  return (
    <ToolkitSettingsContext
      value={controller.desktop.shellState?.appSettings ?? { enabledToolkitExtensions: [] }}
    >
      <DraftInputContributionContext value={DictationDraftInput}>
        <CodingWorkspacePreferencesProvider retain={retainCodingPreferences}>
          <AppShellLayout controller={controller} />
        </CodingWorkspacePreferencesProvider>
      </DraftInputContributionContext>
    </ToolkitSettingsContext>
  )
}
