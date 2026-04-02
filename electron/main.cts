import path from "node:path";
import { BrowserWindow, type OpenDialogOptions, app, dialog, ipcMain } from "electron";
import {
  type ArchivedThread,
  type ComposerAttachment,
  type ComposerState,
  DEFAULT_SHELL_STATE,
  type DesktopEvent,
  type GetComposerStateRequest,
  type GetProjectThreadsRequest,
  type GetThreadRequest,
  IPC_CHANNELS,
  type InvokeActionRequest,
  type PickComposerAttachmentsRequest,
  type ShellState,
  type Thread,
  type ThreadData,
  isDesktopAction,
} from "./contracts.cjs";
import {
  handleDesktopAction,
  loadArchivedThreadList,
  loadComposerState,
  loadProjectThreads,
  loadShellState,
  loadThread,
  subscribeDesktopEvents,
} from "./pi-threads.cjs";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);

function getAttachmentKind(filePath: string): ComposerAttachment["kind"] {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    return "image";
  }

  return "text";
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1220,
    minHeight: 820,
    backgroundColor: "#171821",
    title: "Pi Desktop Mock",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && devServerUrl) {
    void win.loadURL(devServerUrl);
    return;
  }

  void win.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  subscribeDesktopEvents((event: DesktopEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.desktopEvent, event);
    }
  });

  ipcMain.handle(IPC_CHANNELS.getShellState, async (): Promise<ShellState> => {
    try {
      return await loadShellState(process.cwd());
    } catch {
      return DEFAULT_SHELL_STATE;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.pickComposerAttachments,
    async (
      event,
      request: PickComposerAttachmentsRequest | null | undefined,
    ): Promise<ComposerAttachment[]> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: OpenDialogOptions = {
        defaultPath:
          typeof request?.projectId === "string" && request.projectId
            ? request.projectId
            : process.cwd(),
        properties: ["openFile", "multiSelections"],
      };
      const result = browserWindow
        ? await dialog.showOpenDialog(browserWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled) {
        return [];
      }

      return result.filePaths.map((filePath) => ({
        path: filePath,
        name: path.basename(filePath),
        kind: getAttachmentKind(filePath),
      }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getComposerState,
    async (_event, request: GetComposerStateRequest | null | undefined): Promise<ComposerState> => {
      return loadComposerState(request ?? {});
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getProjectThreads,
    async (_event, request: GetProjectThreadsRequest | null | undefined): Promise<Thread[]> => {
      if (!request?.projectId || typeof request.projectId !== "string") {
        return [];
      }

      try {
        return await loadProjectThreads(request.projectId);
      } catch {
        return [];
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.getArchivedThreads, async (): Promise<ArchivedThread[]> => {
    try {
      return await loadArchivedThreadList();
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.getThread,
    async (_event, request: GetThreadRequest | null | undefined): Promise<ThreadData | null> => {
      if (!request?.sessionPath || typeof request.sessionPath !== "string") {
        return null;
      }

      try {
        return await loadThread(request.sessionPath);
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.invokeAction, async (_event, request: InvokeActionRequest | null) => {
    if (!request || !isDesktopAction(request.action)) {
      throw new Error(`Unsupported desktop action: ${request?.action ?? "unknown"}`);
    }

    await handleDesktopAction(request.action, request.payload ?? {});

    return {
      ok: true,
      at: new Date().toISOString(),
      payload: {
        action: request.action,
        payload: request.payload ?? {},
      },
    };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
