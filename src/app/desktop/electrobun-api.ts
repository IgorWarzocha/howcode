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
  TurnDiffResult,
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

function hasElectrobunGlobals() {
  return (
    typeof window.__electrobunWebviewId === "number" &&
    typeof window.__electrobunRpcSocketPort === "number"
  );
}

async function waitForElectrobunGlobals(timeoutMs = 3_000) {
  const startedAt = Date.now();

  while (!hasElectrobunGlobals()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Electrobun RPC globals are unavailable.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

async function getElectroview() {
  await waitForElectrobunGlobals();

  if (!electrobun) {
    electrobun = new Electrobun.Electroview({ rpc });
  }

  return electrobun;
}

async function getRpc() {
  const bridge = (await getElectroview()).rpc;
  if (!bridge) {
    throw new Error("Electrobun RPC bridge is unavailable.");
  }

  return bridge;
}

export const piDesktopApi = {
  getShellState: async () => (await getRpc()).request.getShellState({}) as Promise<ShellState>,
  getProjectGitState: async (projectId: string) =>
    (await getRpc()).request.getProjectGitState({ projectId }) as Promise<ProjectGitState | null>,
  pickComposerAttachments: async (projectId: string | null = null) =>
    (await getRpc()).request.pickComposerAttachments({
      projectId,
    }) as Promise<ComposerAttachment[]>,
  getComposerState: async (request: ComposerStateRequest = {}) =>
    (await getRpc()).request.getComposerState(request) as Promise<ComposerState>,
  getProjectThreads: async (projectId: string) =>
    (await getRpc()).request.getProjectThreads({ projectId }) as Promise<Thread[]>,
  getArchivedThreads: async () =>
    (await getRpc()).request.getArchivedThreads({}) as Promise<ArchivedThread[]>,
  getThread: async (sessionPath: string) =>
    (await getRpc()).request.getThread({ sessionPath }) as Promise<ThreadData | null>,
  watchSession: async (sessionPath: string | null) => {
    await (await getRpc()).request.watchSession({ sessionPath });
  },
  getTurnDiff: async (sessionPath: string, checkpointTurnCount: number) =>
    (await getRpc()).request.getTurnDiff({
      sessionPath,
      checkpointTurnCount,
    }) as Promise<TurnDiffResult | null>,
  getFullThreadDiff: async (sessionPath: string) =>
    (await getRpc()).request.getFullThreadDiff({ sessionPath }) as Promise<TurnDiffResult | null>,
  openTerminal: async (request: TerminalOpenRequest) =>
    (await getRpc()).request.terminalOpen(request) as Promise<TerminalSessionSnapshot>,
  writeTerminal: async (sessionId: string, data: string) => {
    await (await getRpc()).request.terminalWrite({ sessionId, data });
  },
  resizeTerminal: async (request: TerminalResizeRequest) => {
    await (await getRpc()).request.terminalResize(request);
  },
  closeTerminal: async (request: TerminalCloseRequest) => {
    await (await getRpc()).request.terminalClose(request);
  },
  openExternal: async (url: string) => {
    const response = await (await getRpc()).request.openExternal({ url });
    return response.ok;
  },
  openPath: async (path: string) => {
    const response = await (await getRpc()).request.openPath({ path });
    return response.ok;
  },
  subscribe: (listener: (event: DesktopEvent) => void) => {
    desktopListeners.add(listener);

    void getElectroview().catch(() => undefined);

    return () => {
      desktopListeners.delete(listener);
    };
  },
  subscribeTerminal: (listener: (event: TerminalEvent) => void) => {
    terminalListeners.add(listener);

    void getElectroview().catch(() => undefined);

    return () => {
      terminalListeners.delete(listener);
    };
  },
  invokeAction: async (action: DesktopAction, payload: DesktopActionPayload = {}) =>
    (await getRpc()).request.invokeAction({ action, payload }) as Promise<DesktopActionResult>,
};
