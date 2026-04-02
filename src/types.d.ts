import type { DesktopAction } from "./app/desktop/actions";
import type {
  DesktopActionPayload,
  DesktopActionResult,
  ShellState,
  ThreadData,
} from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      getThread?: (sessionPath: string) => Promise<ThreadData | null>;
      invokeAction: (
        action: DesktopAction,
        payload?: DesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
