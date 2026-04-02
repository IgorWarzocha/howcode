import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAction } from "../shared/desktop-actions.js";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopEvent,
  ProjectGitState,
  ShellState,
  Thread,
  ThreadData,
} from "../shared/desktop-contracts.js";
import { type DesktopActionPayload, IPC_CHANNELS, isDesktopAction } from "./contracts.cjs";

type PiDesktopApi = {
  getShellState: () => Promise<ShellState>;
  getProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  pickComposerAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  getComposerState: (request?: ComposerStateRequest) => Promise<ComposerState>;
  getProjectThreads: (projectId: string) => Promise<Thread[]>;
  getArchivedThreads: () => Promise<ArchivedThread[]>;
  getThread: (sessionPath: string) => Promise<ThreadData | null>;
  subscribe: (listener: (event: DesktopEvent) => void) => () => void;
  invokeAction: (
    action: DesktopAction,
    payload?: DesktopActionPayload,
  ) => Promise<DesktopActionResult>;
};

const api: PiDesktopApi = {
  getShellState: () => ipcRenderer.invoke(IPC_CHANNELS.getShellState),
  getProjectGitState: (projectId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getProjectGitState, { projectId }),
  pickComposerAttachments: (projectId = null) =>
    ipcRenderer.invoke(IPC_CHANNELS.pickComposerAttachments, { projectId }),
  getComposerState: (request = {}) => ipcRenderer.invoke(IPC_CHANNELS.getComposerState, request),
  getProjectThreads: (projectId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getProjectThreads, { projectId }),
  getArchivedThreads: () => ipcRenderer.invoke(IPC_CHANNELS.getArchivedThreads),
  getThread: (sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.getThread, { sessionPath }),
  subscribe: (listener) => {
    const handleEvent = (_event: Electron.IpcRendererEvent, desktopEvent: DesktopEvent) => {
      listener(desktopEvent);
    };

    ipcRenderer.on(IPC_CHANNELS.desktopEvent, handleEvent);

    return () => {
      ipcRenderer.off(IPC_CHANNELS.desktopEvent, handleEvent);
    };
  },
  invokeAction: (action, payload = {}) => {
    if (!isDesktopAction(action)) {
      throw new Error(`Unsupported renderer desktop action: ${String(action)}`);
    }

    return ipcRenderer.invoke(IPC_CHANNELS.invokeAction, { action, payload });
  },
};

contextBridge.exposeInMainWorld("piDesktop", api);
