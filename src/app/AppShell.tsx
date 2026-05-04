import { AppShellLayout } from "./app-shell/AppShellLayout";
import { useAppShellController } from "./app-shell/useAppShellController";
import { usePiGuiTheme } from "./app-shell/usePiGuiTheme";

export function AppShell() {
  const controller = useAppShellController();
  usePiGuiTheme(controller.shellState?.piTheme);
  return <AppShellLayout controller={controller} />;
}
