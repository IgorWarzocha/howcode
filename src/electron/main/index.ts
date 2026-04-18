import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./app/create-main-window";
import { loadMainWindow } from "./app/load-main-window";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc";
import { configureDevtoolsRemoteDebugging, logDevtoolsRemoteDebugging } from "./runtime/devtools";
import { configureDesktopEnvironment } from "./runtime/environment";
import { loadDesktopRuntimeModules } from "./runtime/load-desktop-runtime";

let currentMainWindow: BrowserWindow | null = null;
const devtoolsDebuggingPort = configureDevtoolsRemoteDebugging();

app.setName("howcode");

async function openMainWindow() {
  const mainWindow = createMainWindow();
  currentMainWindow = mainWindow;
  mainWindow.on("closed", () => {
    if (currentMainWindow === mainWindow) {
      currentMainWindow = null;
    }
  });

  await loadMainWindow(mainWindow);
  return mainWindow;
}

async function bootstrap() {
  await app.whenReady();
  configureDesktopEnvironment();
  logDevtoolsRemoteDebugging(devtoolsDebuggingPort);

  const runtime = await loadDesktopRuntimeModules();
  registerDesktopIpc(() => currentMainWindow, runtime);
  await openMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await openMainWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap Electron app.", error);
  app.quit();
});
