import { AppShellLayout } from "./app-shell/AppShellLayout";
import { useAppShellController } from "./app-shell/useAppShellController";

export function AppShell() {
  const controller = useAppShellController();
  return <AppShellLayout controller={controller} />;
}
