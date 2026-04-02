import type { DesktopAction } from "./app/desktop/actions";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  DesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
  ProjectGitState,
  ShellState,
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  Thread,
  ThreadData,
} from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      getProjectGitState?: (projectId: string) => Promise<ProjectGitState | null>;
      pickComposerAttachments?: (projectId?: string | null) => Promise<ComposerAttachment[]>;
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>;
      getProjectThreads?: (projectId: string) => Promise<Thread[]>;
      getArchivedThreads?: () => Promise<ArchivedThread[]>;
      getThread?: (sessionPath: string) => Promise<ThreadData | null>;
      openTerminal?: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>;
      writeTerminal?: (sessionId: string, data: string) => Promise<void>;
      resizeTerminal?: (request: TerminalResizeRequest) => Promise<void>;
      closeTerminal?: (request: TerminalCloseRequest) => Promise<void>;
      subscribeTerminal?: (listener: (event: TerminalEvent) => void) => () => void;
      openExternal?: (url: string) => Promise<boolean>;
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void;
      invokeAction: (
        action: DesktopAction,
        payload?: DesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
