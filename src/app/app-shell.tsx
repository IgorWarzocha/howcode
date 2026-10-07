import { AppShellLayout } from './app-shell/app-shell-layout'
import { useAppShellController } from './app-shell/useAppShellController'
import { usePiGuiTheme } from './app-shell/usePiGuiTheme'
import { ToolkitSettingsContext } from './extensions/toolkit-context'

export function AppShell() {
  const controller = useAppShellController()
  usePiGuiTheme(controller.desktop.shellState?.piTheme)
  return (
    <ToolkitSettingsContext
      value={controller.desktop.shellState?.appSettings ?? { enabledToolkitExtensions: [] }}
    >
      <AppShellLayout controller={controller} />
    </ToolkitSettingsContext>
  )
}
