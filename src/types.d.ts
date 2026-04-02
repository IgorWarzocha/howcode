import type { DesktopAction } from "./app/desktop/actions";
import type {
  ArchivedThread,
  ComposerState,
  ComposerStateRequest,
  DesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
  ShellState,
  Thread,
  ThreadData,
} from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>;
      getProjectThreads?: (projectId: string) => Promise<Thread[]>;
      getArchivedThreads?: () => Promise<ArchivedThread[]>;
      getThread?: (sessionPath: string) => Promise<ThreadData | null>;
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void;
      invokeAction: (
        action: DesktopAction,
        payload?: DesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
