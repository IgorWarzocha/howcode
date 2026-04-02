import type { DesktopAction } from "./app/desktop/actions";
import type {
  ArchivedThread,
  DesktopActionPayload,
  DesktopActionResult,
  ShellState,
  Thread,
  ThreadData,
} from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      getProjectThreads?: (projectId: string) => Promise<Thread[]>;
      getArchivedThreads?: () => Promise<ArchivedThread[]>;
      getThread?: (sessionPath: string) => Promise<ThreadData | null>;
      invokeAction: (
        action: DesktopAction,
        payload?: DesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
