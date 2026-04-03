import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { DesktopAction } from "../../shared/desktop-actions";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  DesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
  ProjectGitState,
  ShellState,
  Thread,
  ThreadData,
  TurnDiffResult,
} from "../../shared/desktop-contracts";
import type { PiDesktopRpc } from "../../shared/electrobun-rpc";
import type { TerminalEvent, TerminalSessionSnapshot } from "../../shared/terminal-contracts";

if (process.platform === "linux" && !process.env.WEBKIT_DISABLE_DMABUF_RENDERER) {
  process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1";
}

type PiThreadsModule = {
  handleDesktopAction: (action: DesktopAction, payload: DesktopActionPayload) => Promise<void>;
  loadArchivedThreadList: () => Promise<ArchivedThread[]>;
  loadComposerState: (request: Record<string, unknown>) => Promise<ComposerState>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectThreads: (projectId: string) => Promise<Thread[]>;
  loadShellState: (cwd: string) => Promise<ShellState>;
  loadThread: (
    sessionPath: string,
    options?: { includeHistory?: boolean },
  ) => Promise<ThreadData | null>;
  setWatchedSessionPath: (sessionPath: string | null) => Promise<void>;
  loadTurnDiff: (
    sessionPath: string,
    checkpointTurnCount: number,
  ) => Promise<TurnDiffResult | null>;
  loadFullThreadDiff: (sessionPath: string) => Promise<TurnDiffResult | null>;
  subscribeDesktopEvents: (listener: (event: DesktopEvent) => void) => () => void;
};

type TerminalManagerModule = {
  closeTerminal: (request: { sessionId: string; deleteHistory?: boolean }) => Promise<void>;
  openTerminal: (request: Record<string, unknown>) => Promise<TerminalSessionSnapshot>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  subscribeTerminalEvents: (listener: (event: TerminalEvent) => void) => () => void;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
};

const piThreads = (await import(
  new URL("../build/desktop/pi-threads.mjs", import.meta.url).pathname
)) as PiThreadsModule;
const terminalManager = (await import(
  new URL("../build/desktop/terminal-manager.mjs", import.meta.url).pathname
)) as TerminalManagerModule;

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return DEV_SERVER_URL;
    } catch {
      // Fall through to packaged views.
    }
  }

  return "views://mainview/index.html";
}

const rpc = BrowserView.defineRPC<PiDesktopRpc>({
  maxRequestTime: 60_000,
  handlers: {
    requests: {
      getShellState: async () => piThreads.loadShellState(process.cwd()) as Promise<ShellState>,
      getProjectGitState: async ({ projectId }) =>
        (await piThreads.loadProjectGitState(projectId)) as ProjectGitState | null,
      pickComposerAttachments: async ({ projectId }) => {
        const filePaths = await Utils.openFileDialog({
          startingFolder: projectId ?? process.cwd(),
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        return filePaths
          .filter((filePath) => filePath.length > 0)
          .map((filePath) => ({
            path: filePath,
            name: filePath.split(/[\\/]/).pop() ?? filePath,
            kind: /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filePath) ? "image" : "text",
          })) as ComposerAttachment[];
      },
      getComposerState: async (request) =>
        piThreads.loadComposerState(request) as Promise<ComposerState>,
      getProjectThreads: async ({ projectId }) =>
        piThreads.loadProjectThreads(projectId) as Promise<Thread[]>,
      getArchivedThreads: async () =>
        piThreads.loadArchivedThreadList() as Promise<ArchivedThread[]>,
      getThread: async ({ sessionPath, includeHistory = false }) =>
        piThreads.loadThread(sessionPath, { includeHistory }) as Promise<ThreadData | null>,
      watchSession: async ({ sessionPath }) => {
        await piThreads.setWatchedSessionPath(sessionPath);
        return { ok: true };
      },
      getTurnDiff: async ({ sessionPath, checkpointTurnCount }) =>
        piThreads.loadTurnDiff(sessionPath, checkpointTurnCount) as Promise<TurnDiffResult | null>,
      getFullThreadDiff: async ({ sessionPath }) =>
        piThreads.loadFullThreadDiff(sessionPath) as Promise<TurnDiffResult | null>,
      invokeAction: async ({ action, payload = {} }) => {
        await piThreads.handleDesktopAction(action, payload);
        return {
          ok: true,
          at: new Date().toISOString(),
          payload: { action, payload },
        } as DesktopActionResult;
      },
      terminalOpen: async (request) =>
        terminalManager.openTerminal(request) as Promise<TerminalSessionSnapshot>,
      terminalWrite: async ({ sessionId, data }) => {
        await terminalManager.writeTerminal(sessionId, data);
        return { ok: true };
      },
      terminalResize: async (request) => {
        await terminalManager.resizeTerminal(request.sessionId, request.cols, request.rows);
        return { ok: true };
      },
      terminalClose: async (request) => {
        await terminalManager.closeTerminal(request);
        return { ok: true };
      },
      openExternal: async ({ url }) => ({ ok: Utils.openExternal(url) }),
      openPath: async ({ path }) => ({ ok: Utils.openPath(path) }),
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: "Pi Desktop Mock",
  url: await getMainViewUrl(),
  rpc,
  frame: {
    width: 1480,
    height: 980,
    x: 120,
    y: 80,
  },
});

piThreads.subscribeDesktopEvents((event: DesktopEvent) => {
  mainWindow.webview.rpc?.send?.desktopEvent(event);
});

terminalManager.subscribeTerminalEvents((event: TerminalEvent) => {
  mainWindow.webview.rpc?.send?.terminalEvent(event);
});
