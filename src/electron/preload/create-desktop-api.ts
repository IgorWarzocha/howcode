import { ipcRenderer, type IpcRendererEvent, webUtils } from "electron";
import {
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
  type DesktopEventChannel,
  type DesktopEventMap,
  type DesktopRequestChannel,
  type DesktopRequestMap,
} from "../../../shared/desktop-ipc";
import type { DesktopAction } from "../../app/desktop/actions";
import type {
  AnyDesktopActionPayload,
  DesktopEvent,
  TerminalOpenRequest,
  TerminalEvent,
} from "../../app/desktop/types";

function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]["params"],
) {
  return ipcRenderer.invoke(getDesktopRequestIpcChannel(channel), params) as Promise<
    DesktopRequestMap[K]["response"]
  >;
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const ipcChannel = getDesktopEventIpcChannel(channel);
  const wrappedListener = (_event: IpcRendererEvent, payload: DesktopEventMap[K]) => {
    listener(payload);
  };

  ipcRenderer.on(ipcChannel, wrappedListener);
  return () => {
    ipcRenderer.removeListener(ipcChannel, wrappedListener);
  };
}

export function createDesktopApi() {
  return {
    getShellState: () => invokeRequest("getShellState", {}),
    getProjectGitState: (projectId: string) => invokeRequest("getProjectGitState", { projectId }),
    getProjectDiff: (projectId: string, baseline = null) =>
      invokeRequest("getProjectDiff", { projectId, baseline }),
    getProjectDiffStats: (projectId: string, baseline = null) =>
      invokeRequest("getProjectDiffStats", { projectId, baseline }),
    captureProjectDiffBaseline: (projectId: string) =>
      invokeRequest("captureProjectDiffBaseline", { projectId }),
    listProjectCommits: (projectId: string, limit: number | null = null) =>
      invokeRequest("listProjectCommits", { projectId, limit }),
    searchPiPackages: (request = {}) => invokeRequest("searchPiPackages", request),
    getConfiguredPiPackages: (request = {}) => invokeRequest("getConfiguredPiPackages", request),
    installPiPackage: (request: {
      source: string;
      kind?: "npm" | "git";
      local?: boolean;
      projectPath?: string | null;
    }) => invokeRequest("installPiPackage", request),
    removePiPackage: (request: {
      source: string;
      local?: boolean;
      projectPath?: string | null;
    }) => invokeRequest("removePiPackage", request),
    searchPiSkills: (request = {}) => invokeRequest("searchPiSkills", request),
    getConfiguredPiSkills: (request = {}) => invokeRequest("getConfiguredPiSkills", request),
    installPiSkill: (request: {
      source: string;
      local?: boolean;
      projectPath?: string | null;
    }) => invokeRequest("installPiSkill", request),
    removePiSkill: (request: { installedPath: string; projectPath?: string | null }) =>
      invokeRequest("removePiSkill", request),
    startSkillCreatorSession: (request: {
      prompt: string;
      local?: boolean;
      projectPath?: string | null;
    }) => invokeRequest("startSkillCreatorSession", request),
    continueSkillCreatorSession: (request: { sessionId: string; prompt: string }) =>
      invokeRequest("continueSkillCreatorSession", request),
    closeSkillCreatorSession: (sessionId: string) =>
      invokeRequest("closeSkillCreatorSession", { sessionId }),
    pickComposerAttachments: (projectId: string | null = null) =>
      invokeRequest("pickComposerAttachments", { projectId }),
    readClipboardSnapshot: (formats: string[] | null = null) =>
      invokeRequest("readClipboardSnapshot", { formats }),
    readClipboardFilePaths: () => invokeRequest("readClipboardFilePaths", {}),
    getAttachmentKindsForPaths: (paths: string[]) =>
      invokeRequest("getAttachmentKindsForPaths", { paths }),
    getPathForFile: (file: File) => {
      try {
        return webUtils.getPathForFile(file) || null;
      } catch {
        return null;
      }
    },
    listComposerAttachmentEntries: (request = {}) =>
      invokeRequest("listComposerAttachmentEntries", request),
    getComposerState: (request = {}) => invokeRequest("getComposerState", request),
    getDictationState: () => invokeRequest("getDictationState", {}),
    listDictationModels: () => invokeRequest("listDictationModels", {}),
    installDictationModel: (modelId: "tiny.en" | "base.en" | "small.en") =>
      invokeRequest("installDictationModel", { modelId }),
    removeDictationModel: (modelId: "tiny.en" | "base.en" | "small.en") =>
      invokeRequest("removeDictationModel", { modelId }),
    transcribeDictation: (request: {
      audioBase64: string;
      sampleRate: number;
      language?: string | null;
    }) => invokeRequest("transcribeDictation", request),
    getProjectThreads: (projectId: string) => invokeRequest("getProjectThreads", { projectId }),
    getInboxThreads: () => invokeRequest("getInboxThreads", {}),
    getArchivedThreads: () => invokeRequest("getArchivedThreads", {}),
    getThread: (sessionPath: string, historyCompactions = 0) =>
      invokeRequest("getThread", { sessionPath, historyCompactions }),
    watchSession: async (sessionPath: string | null) => {
      await invokeRequest("watchSession", { sessionPath });
    },
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      invokeRequest("invokeAction", { action, payload }),
    listTerminals: () => invokeRequest("listTerminals", {}),
    openTerminal: (request: TerminalOpenRequest) => invokeRequest("terminalOpen", request),
    writeTerminal: async (sessionId: string, data: string) => {
      await invokeRequest("terminalWrite", { sessionId, data });
    },
    resizeTerminal: async (request: { sessionId: string; cols: number; rows: number }) => {
      await invokeRequest("terminalResize", request);
    },
    closeTerminal: async (request: { sessionId: string; deleteHistory?: boolean }) => {
      await invokeRequest("terminalClose", request);
    },
    openExternal: (url: string) => invokeRequest("openExternal", { url }).then(({ ok }) => ok),
    openPath: (path: string) => invokeRequest("openPath", { path }).then(({ ok }) => ok),
    subscribe: (listener: (event: DesktopEvent) => void) =>
      subscribeToEvent("desktopEvent", listener),
    subscribeTerminal: (listener: (event: TerminalEvent) => void) =>
      subscribeToEvent("terminalEvent", listener),
  };
}
