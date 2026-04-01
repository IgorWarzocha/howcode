import type { DesktopAction } from "./app/desktop/actions";
import type { DesktopActionPayload, DesktopActionResult, ShellState } from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      invokeAction: (
        action: DesktopAction,
        payload?: DesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
