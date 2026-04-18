import { ipcMain, type BrowserWindow } from "electron";
import {
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
  type DesktopRequestChannel,
  type DesktopRequestHandlerMap,
} from "../../../../shared/desktop-ipc";
import type { DesktopRuntimeModules } from "../runtime/desktop-runtime-contracts";
import { createPiPackagesHandlers } from "./request-handlers/pi-packages";
import { createPiSkillsHandlers } from "./request-handlers/pi-skills";
import { createPiThreadsHandlers } from "./request-handlers/pi-threads";
import { createSkillCreatorHandlers } from "./request-handlers/skill-creator";
import { createSystemHandlers } from "./request-handlers/system";
import { createTerminalHandlers } from "./request-handlers/terminal";

function registerRequestHandlers(handlers: DesktopRequestHandlerMap) {
  for (const channel of Object.keys(handlers) as DesktopRequestChannel[]) {
    ipcMain.handle(getDesktopRequestIpcChannel(channel), (_event, params) =>
      handlers[channel](params),
    );
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

  registerRequestHandlers(handlers);

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
