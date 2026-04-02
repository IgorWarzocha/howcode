import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAction } from "../shared/desktop-actions.js";
import type {
  ArchivedThread,
  DesktopActionResult,
  ShellState,
  Thread,
  ThreadData,
} from "../shared/desktop-contracts.js";
import { type DesktopActionPayload, IPC_CHANNELS, isDesktopAction } from "./contracts.cjs";

type PiDesktopApi = {
  getShellState: () => Promise<ShellState>;
  getProjectThreads: (projectId: string) => Promise<Thread[]>;
  getArchivedThreads: () => Promise<ArchivedThread[]>;
  getThread: (sessionPath: string) => Promise<ThreadData | null>;
  invokeAction: (
    action: DesktopAction,
    payload?: DesktopActionPayload,
  ) => Promise<DesktopActionResult>;
};

const api: PiDesktopApi = {
  getShellState: () => ipcRenderer.invoke(IPC_CHANNELS.getShellState),
  getProjectThreads: (projectId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getProjectThreads, { projectId }),
  getArchivedThreads: () => ipcRenderer.invoke(IPC_CHANNELS.getArchivedThreads),
  getThread: (sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.getThread, { sessionPath }),
  invokeAction: (action, payload = {}) => {
    if (!isDesktopAction(action)) {
      throw new Error(`Unsupported renderer desktop action: ${String(action)}`);
    }

    return ipcRenderer.invoke(IPC_CHANNELS.invokeAction, { action, payload });
  },
};

contextBridge.exposeInMainWorld("piDesktop", api);
