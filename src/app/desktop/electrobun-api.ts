import Electrobun, { Electroview } from "electrobun/view";
import type { PiDesktopRpc } from "../../../shared/electrobun-rpc.js";
import type { DesktopAction } from "./actions";
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
} from "./types";

const desktopListeners = new Set<(event: DesktopEvent) => void>();
const terminalListeners = new Set<(event: TerminalEvent) => void>();

const rpc = Electroview.defineRPC<PiDesktopRpc>({
  maxRequestTime: 60_000,
  handlers: {
    requests: {},
    messages: {
      desktopEvent: (event) => {
        for (const listener of desktopListeners) {
          listener(event);
        }
      },
      terminalEvent: (event) => {
        for (const listener of terminalListeners) {
          listener(event);
        }
      },
    },
  },
});

let electrobun: InstanceType<typeof Electrobun.Electroview<typeof rpc>> | null = null;

function getElectroview() {
  if (!electrobun) {
    electrobun = new Electrobun.Electroview({ rpc });
  }

  return electrobun;
}

function getRpc() {
  const bridge = getElectroview().rpc;
  if (!bridge) {
    throw new Error("Electrobun RPC bridge is unavailable.");
  }

  return bridge;
}

export const piDesktopApi = {
  getShellState: () => getRpc().request.getShellState({}) as Promise<ShellState>,
  getProjectGitState: (projectId: string) =>
    getRpc().request.getProjectGitState({ projectId }) as Promise<ProjectGitState | null>,
  pickComposerAttachments: (projectId: string | null = null) =>
    getRpc().request.pickComposerAttachments({ projectId }) as Promise<ComposerAttachment[]>,
  getComposerState: (request: ComposerStateRequest = {}) =>
    getRpc().request.getComposerState(request) as Promise<ComposerState>,
  getProjectThreads: (projectId: string) =>
    getRpc().request.getProjectThreads({ projectId }) as Promise<Thread[]>,
  getArchivedThreads: () => getRpc().request.getArchivedThreads({}) as Promise<ArchivedThread[]>,
  getThread: (sessionPath: string) =>
    getRpc().request.getThread({ sessionPath }) as Promise<ThreadData | null>,
  openTerminal: (request: TerminalOpenRequest) =>
    getRpc().request.terminalOpen(request) as Promise<TerminalSessionSnapshot>,
  writeTerminal: async (sessionId: string, data: string) => {
    await getRpc().request.terminalWrite({ sessionId, data });
  },
  resizeTerminal: async (request: TerminalResizeRequest) => {
    await getRpc().request.terminalResize(request);
  },
  closeTerminal: async (request: TerminalCloseRequest) => {
    await getRpc().request.terminalClose(request);
  },
  openExternal: async (url: string) => {
    const response = await getRpc().request.openExternal({ url });
    return response.ok;
  },
  subscribe: (listener: (event: DesktopEvent) => void) => {
    getElectroview();
    desktopListeners.add(listener);
    return () => {
      desktopListeners.delete(listener);
    };
  },
  subscribeTerminal: (listener: (event: TerminalEvent) => void) => {
    getElectroview();
    terminalListeners.add(listener);
    return () => {
      terminalListeners.delete(listener);
    };
  },
  invokeAction: (action: DesktopAction, payload: DesktopActionPayload = {}) =>
    getRpc().request.invokeAction({ action, payload }) as Promise<DesktopActionResult>,
};
