const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { DEFAULT_SHELL_STATE, isDesktopAction } = require("./contracts.cjs");
const { loadShellState, loadThread } = require("./pi-threads.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

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

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("pi:get-shell-state", async () => {
    try {
      return await loadShellState(process.cwd());
    } catch {
      return DEFAULT_SHELL_STATE;
    }
  });

  ipcMain.handle("pi:get-thread", async (_event, request) => {
    if (!request?.sessionPath || typeof request.sessionPath !== "string") {
      return null;
    }

    try {
      return await loadThread(request.sessionPath, process.cwd());
    } catch {
      return null;
    }
  });

  ipcMain.handle("pi:invoke-action", async (_event, request) => {
    if (!request || !isDesktopAction(request.action)) {
      throw new Error(`Unsupported desktop action: ${request?.action ?? "unknown"}`);
    }

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
