import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import {
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
  type DesktopRequestChannel,
  type DesktopRequestHandlerMap,
} from "../../../../shared/desktop-ipc";
import { resolveConfiguredDevServerUrl } from "../../../../shared/dev-server";
import { isTrustedRendererUrl } from "../app/navigation-security";
import type { DesktopRuntimeModules } from "../runtime/desktop-runtime-contracts";
import { getRendererDistDirectory } from "../runtime/app-paths";
import { createPiPackagesHandlers } from "./request-handlers/pi-packages";
import { createPiSkillsHandlers } from "./request-handlers/pi-skills";
import { createPiThreadsHandlers } from "./request-handlers/pi-threads";
import { createSkillCreatorHandlers } from "./request-handlers/skill-creator";
import { createSystemHandlers } from "./request-handlers/system";
import { createTerminalHandlers } from "./request-handlers/terminal";

function getRendererTrustConfig() {
  return {
    rendererDistDirectory: getRendererDistDirectory(),
    devServerUrl: app.isPackaged
      ? null
      : resolveConfiguredDevServerUrl([
          process.env.HOWCODE_REPO_ROOT ?? "",
          app.getAppPath(),
          process.cwd(),
        ]),
  };
}

function assertTrustedDesktopIpcEvent(
  event: IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null,
) {
  const mainWindow = getMainWindow();
  const senderUrl = event.senderFrame?.url || event.sender.getURL();

  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error("Blocked desktop IPC request from a non-main renderer.");
  }

  if (!isTrustedRendererUrl(senderUrl, getRendererTrustConfig())) {
    throw new Error(`Blocked desktop IPC request from untrusted renderer URL: ${senderUrl}`);
  }
}

function registerRequestHandlers(
  handlers: DesktopRequestHandlerMap,
  getMainWindow: () => BrowserWindow | null,
) {
  for (const channel of Object.keys(handlers) as DesktopRequestChannel[]) {
    ipcMain.handle(getDesktopRequestIpcChannel(channel), (event, params) => {
      assertTrustedDesktopIpcEvent(event, getMainWindow);
      return handlers[channel](params);
    });
  }
}

export function registerDesktopIpc(
  getMainWindow: () => BrowserWindow | null,
  runtime: DesktopRuntimeModules,
) {
  const handlers: DesktopRequestHandlerMap = {
    ...createPiThreadsHandlers(runtime.piThreads),
    ...createPiPackagesHandlers(runtime.piThreads),
    ...createPiSkillsHandlers(runtime.piSkills),
    ...createSkillCreatorHandlers(runtime.skillCreator),
    ...createTerminalHandlers(runtime.terminalManager),
    ...createSystemHandlers(),
  };

  registerRequestHandlers(handlers, getMainWindow);

  runtime.piThreads.subscribeDesktopEvents((event) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(getDesktopEventIpcChannel("desktopEvent"), event);
    }
  });

  runtime.terminalManager.subscribeTerminalEvents((event) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(getDesktopEventIpcChannel("terminalEvent"), event);
    }
  });
}
