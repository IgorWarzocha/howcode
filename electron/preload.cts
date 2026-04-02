import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAction } from "../shared/desktop-actions.js";
import type { DesktopActionResult, ShellState, ThreadData } from "../shared/desktop-contracts.js";
import { type DesktopActionPayload, IPC_CHANNELS, isDesktopAction } from "./contracts.cjs";

type PiDesktopApi = {
  getShellState: () => Promise<ShellState>;
  getThread: (sessionPath: string) => Promise<ThreadData | null>;
  invokeAction: (
    action: DesktopAction,
    payload?: DesktopActionPayload,
  ) => Promise<DesktopActionResult>;
};

const api: PiDesktopApi = {
  getShellState: () => ipcRenderer.invoke(IPC_CHANNELS.getShellState),
  getThread: (sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.getThread, { sessionPath }),
  invokeAction: (action, payload = {}) => {
    if (!isDesktopAction(action)) {
      throw new Error(`Unsupported renderer desktop action: ${String(action)}`);
    }

    return ipcRenderer.invoke(IPC_CHANNELS.invokeAction, { action, payload });
  },
};

contextBridge.exposeInMainWorld("piDesktop", api);
