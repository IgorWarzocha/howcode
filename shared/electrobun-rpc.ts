import type { RPCSchema } from "electrobun/view";
import type { DesktopAction } from "./desktop-actions";
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
  Thread,
  ThreadData,
  TurnDiffResult,
} from "./desktop-contracts";
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalWriteRequest,
} from "./terminal-contracts";

export type PiDesktopRpc = {
  bun: RPCSchema<{
    requests: {
      getShellState: { params: Record<string, never>; response: ShellState };
      getProjectGitState: { params: { projectId: string }; response: ProjectGitState | null };
      pickComposerAttachments: {
        params: { projectId?: string | null };
        response: ComposerAttachment[];
      };
      getComposerState: { params: ComposerStateRequest; response: ComposerState };
      getProjectThreads: { params: { projectId: string }; response: Thread[] };
      getArchivedThreads: { params: Record<string, never>; response: ArchivedThread[] };
      getThread: {
        params: { sessionPath: string; historyCompactions?: number };
        response: ThreadData | null;
      };
      watchSession: { params: { sessionPath: string | null }; response: { ok: boolean } };
      getTurnDiff: {
        params: { sessionPath: string; checkpointTurnCount: number };
        response: TurnDiffResult | null;
      };
      getFullThreadDiff: {
        params: { sessionPath: string };
        response: TurnDiffResult | null;
      };
      invokeAction: {
        params: { action: DesktopAction; payload?: DesktopActionPayload };
        response: DesktopActionResult;
      };
      terminalOpen: { params: TerminalOpenRequest; response: TerminalSessionSnapshot };
      terminalWrite: { params: TerminalWriteRequest; response: { ok: boolean } };
      terminalResize: { params: TerminalResizeRequest; response: { ok: boolean } };
      terminalClose: { params: TerminalCloseRequest; response: { ok: boolean } };
      openExternal: { params: { url: string }; response: { ok: boolean } };
      openPath: { params: { path: string }; response: { ok: boolean } };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      desktopEvent: DesktopEvent;
      terminalEvent: TerminalEvent;
    };
  }>;
};
