import { AppShellLayout } from './app-shell/app-shell-layout'
import { useAppShellController } from './app-shell/useAppShellController'
import { usePiGuiTheme } from './app-shell/usePiGuiTheme'
import { BuiltInComponentProviders } from './component-system/built-in-providers'

export function AppShell() {
  const controller = useAppShellController()
  usePiGuiTheme(controller.desktop.shellState?.piTheme)
  return (
    <BuiltInComponentProviders
      settings={controller.desktop.shellState?.appSettings}
      selectedView={controller.workspace.state.activeView}
    >
      <AppShellLayout controller={controller} />
    </BuiltInComponentProviders>
  )
}
