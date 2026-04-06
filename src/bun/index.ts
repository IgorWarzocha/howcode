import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { DesktopAction } from "../../shared/desktop-actions";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerEntry,
  ComposerFilePickerState,
  ComposerState,
  DesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
  PiConfiguredPackage,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  ProjectDiffResult,
  ProjectGitState,
  ShellState,
  Thread,
  ThreadData,
  TurnDiffResult,
} from "../../shared/desktop-contracts";
import type { PiDesktopRpc } from "../../shared/electrobun-rpc";
import type { TerminalEvent, TerminalSessionSnapshot } from "../../shared/terminal-contracts";
import { parseDevServerMetadata, resolveDevServerMetadataPath } from "./dev-server";

if (process.platform === "linux" && !process.env.WEBKIT_DISABLE_DMABUF_RENDERER) {
  process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1";
}

type PiThreadsModule = {
  handleDesktopAction: (
    action: DesktopAction,
    payload: DesktopActionPayload,
  ) => Promise<Record<string, unknown> | null | undefined>;
  loadArchivedThreadList: () => Promise<ArchivedThread[]>;
  loadComposerState: (request: Record<string, unknown>) => Promise<ComposerState>;
  searchPiPackages: (request?: {
    query?: string | null;
    cursor?: number | null;
    pageSize?: number | null;
  }) => Promise<PiPackageCatalogPage>;
  listConfiguredPiPackages: () => Promise<PiConfiguredPackage[]>;
  installPiPackage: (request: {
    source: string;
    kind?: "npm" | "git";
    local?: boolean;
  }) => Promise<PiPackageMutationResult>;
  removePiPackage: (request: {
    source: string;
    local?: boolean;
  }) => Promise<PiPackageMutationResult>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectDiff: (projectId: string) => Promise<ProjectDiffResult | null>;
  loadProjectThreads: (projectId: string) => Promise<Thread[]>;
  loadShellState: (cwd: string) => Promise<ShellState>;
  loadThread: (
    sessionPath: string,
    options?: { historyCompactions?: number },
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

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function normalizeDialogFilePaths(filePaths: string[]) {
  const normalized: string[] = [];

  for (let index = 0; index < filePaths.length; index += 1) {
    let candidate = filePaths[index]?.trim();
    if (!candidate) {
      continue;
    }

    while (!(await pathExists(candidate)) && index + 1 < filePaths.length) {
      index += 1;
      candidate = `${candidate},${filePaths[index] ?? ""}`;
    }

    normalized.push(candidate);
  }

  return normalized;
}

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function getAttachmentKind(filePath: string): ComposerAttachment["kind"] {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filePath) ? "image" : "text";
}

async function listComposerAttachmentEntries(request: {
  projectId?: string | null;
  path?: string | null;
  rootPath?: string | null;
}): Promise<ComposerFilePickerState> {
  const homePath = os.homedir();
  const rootPath = path.resolve(request.rootPath ?? request.projectId ?? process.cwd());
  const requestedPath = path.resolve(request.path ?? rootPath);
  const currentPath = isPathWithinRoot(requestedPath, rootPath) ? requestedPath : rootPath;
  const directoryEntries = await readdir(currentPath, { withFileTypes: true });

  const entries: ComposerFilePickerEntry[] = directoryEntries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        return {
          path: entryPath,
          name: entry.name,
          kind: "directory",
        } satisfies ComposerFilePickerEntry;
      }

      return {
        path: entryPath,
        name: entry.name,
        kind: getAttachmentKind(entryPath),
      } satisfies ComposerFilePickerEntry;
    })
    .sort((left, right) => {
      if (left.kind === "directory" && right.kind !== "directory") {
        return -1;
      }

      if (left.kind !== "directory" && right.kind === "directory") {
        return 1;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });

  return {
    homePath,
    rootPath,
    currentPath,
    parentPath: currentPath === rootPath ? null : path.dirname(currentPath),
    entries,
  };
}

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    const devServerMetadataPath = resolveDevServerMetadataPath([
      process.env.HOWCODE_REPO_ROOT ?? "",
      import.meta.dir,
      process.cwd(),
    ]);

    if (!devServerMetadataPath) {
      console.warn("Falling back to packaged views because the repo root could not be resolved.", {
        moduleDirectoryPath: import.meta.dir,
        processCwd: process.cwd(),
      });
      return "views://mainview/index.html";
    }

    try {
      const rawMetadata = await readFile(devServerMetadataPath, "utf8");
      const devServerUrl = parseDevServerMetadata(rawMetadata);

      if (devServerUrl) {
        await fetch(devServerUrl, { method: "HEAD" });
        return devServerUrl;
      }
    } catch (error) {
      console.warn(
        "Falling back to packaged views because the dev server metadata was unavailable.",
        {
          devServerMetadataPath,
          error,
        },
      );
    }
  }

  return "views://mainview/index.html";
}

const rpc = BrowserView.defineRPC<PiDesktopRpc>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {
      getShellState: async () => piThreads.loadShellState(process.cwd()) as Promise<ShellState>,
      getProjectGitState: async ({ projectId }) =>
        (await piThreads.loadProjectGitState(projectId)) as ProjectGitState | null,
      getProjectDiff: async ({ projectId }) =>
        (await piThreads.loadProjectDiff(projectId)) as ProjectDiffResult | null,
      searchPiPackages: async (request) =>
        piThreads.searchPiPackages(request) as Promise<PiPackageCatalogPage>,
      getConfiguredPiPackages: async () =>
        piThreads.listConfiguredPiPackages() as Promise<PiConfiguredPackage[]>,
      installPiPackage: async (request) =>
        piThreads.installPiPackage(request) as Promise<PiPackageMutationResult>,
      removePiPackage: async (request) =>
        piThreads.removePiPackage(request) as Promise<PiPackageMutationResult>,
      pickComposerAttachments: async ({ projectId }) => {
        const filePaths = await Utils.openFileDialog({
          startingFolder: projectId ?? process.cwd(),
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        const normalizedFilePaths = await normalizeDialogFilePaths(filePaths);

        return normalizedFilePaths
          .filter((filePath) => filePath.length > 0)
          .map((filePath) => ({
            path: filePath,
            name: filePath.split(/[\\/]/).pop() ?? filePath,
            kind: getAttachmentKind(filePath),
          })) as ComposerAttachment[];
      },
      listComposerAttachmentEntries: async (request) =>
        listComposerAttachmentEntries(request) as Promise<ComposerFilePickerState>,
      getComposerState: async (request) =>
        piThreads.loadComposerState(request) as Promise<ComposerState>,
      getProjectThreads: async ({ projectId }) =>
        piThreads.loadProjectThreads(projectId) as Promise<Thread[]>,
      getArchivedThreads: async () =>
        piThreads.loadArchivedThreadList() as Promise<ArchivedThread[]>,
      getThread: async ({ sessionPath, historyCompactions = 0 }) =>
        piThreads.loadThread(sessionPath, { historyCompactions }) as Promise<ThreadData | null>,
      watchSession: async ({ sessionPath }) => {
        await piThreads.setWatchedSessionPath(sessionPath);
        return { ok: true };
      },
      getTurnDiff: async ({ sessionPath, checkpointTurnCount }) =>
        piThreads.loadTurnDiff(sessionPath, checkpointTurnCount) as Promise<TurnDiffResult | null>,
      getFullThreadDiff: async ({ sessionPath }) =>
        piThreads.loadFullThreadDiff(sessionPath) as Promise<TurnDiffResult | null>,
      invokeAction: async ({ action, payload = {} }) => {
        try {
          const result = await piThreads.handleDesktopAction(action, payload);
          return {
            ok: true,
            at: new Date().toISOString(),
            payload: { action, payload },
            result: result ?? null,
          } as DesktopActionResult;
        } catch (error) {
          console.error("invokeAction failed", { action, payload, error });
          return {
            ok: false,
            at: new Date().toISOString(),
            payload: { action, payload },
            result: {
              error: error instanceof Error ? error.message : "Desktop action failed unexpectedly.",
            },
          } as DesktopActionResult;
        }
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
