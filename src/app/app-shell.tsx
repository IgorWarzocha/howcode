import { AppShellLayout } from './app-shell/app-shell-layout'
import { useAppShellController } from './app-shell/useAppShellController'
import { usePiGuiTheme } from './app-shell/usePiGuiTheme'

export function AppShell() {
  const controller = useAppShellController()
  usePiGuiTheme(controller.shellState?.piTheme)
  return <AppShellLayout controller={controller} />
}
