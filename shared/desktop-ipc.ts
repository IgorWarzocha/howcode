import type { DesktopAction } from "./desktop-actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerAttachment,
  DesktopClipboardFilePaths,
  DesktopClipboardSnapshot,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopEvent,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
  InboxThread,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
  ProjectDiffResult,
  ProjectDiffStatsResult,
  ProjectGitState,
  ShellState,
  SkillCreatorSessionState,
  Thread,
  ThreadData,
} from "./desktop-contracts";
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalWriteRequest,
} from "./terminal-contracts";

export type DesktopRequestMap = {
  getShellState: { params: Record<string, never>; response: ShellState };
  getProjectGitState: { params: { projectId: string }; response: ProjectGitState | null };
  getProjectDiff: {
    params: { projectId: string; baseline?: ProjectDiffBaseline | null };
    response: ProjectDiffResult | null;
  };
  getProjectDiffStats: {
    params: { projectId: string; baseline?: ProjectDiffBaseline | null };
    response: ProjectDiffStatsResult | null;
  };
  captureProjectDiffBaseline: {
    params: { projectId: string };
    response: ProjectDiffResolvedBaseline | null;
  };
  listProjectCommits: {
    params: { projectId: string; limit?: number | null };
    response: ProjectCommitEntry[];
  };
  searchPiPackages: {
    params: { query?: string | null; cursor?: number | null; pageSize?: number | null };
    response: PiPackageCatalogPage;
  };
  getConfiguredPiPackages: {
    params: { projectPath?: string | null };
    response: PiConfiguredPackage[];
  };
  installPiPackage: {
    params: { source: string; kind?: "npm" | "git"; local?: boolean; projectPath?: string | null };
    response: PiPackageMutationResult;
  };
  removePiPackage: {
    params: { source: string; local?: boolean; projectPath?: string | null };
    response: PiPackageMutationResult;
  };
  searchPiSkills: {
    params: { query?: string | null; limit?: number | null };
    response: PiSkillCatalogPage;
  };
  getConfiguredPiSkills: {
    params: { projectPath?: string | null };
    response: PiConfiguredSkill[];
  };
  installPiSkill: {
    params: { source: string; local?: boolean; projectPath?: string | null };
    response: PiSkillMutationResult;
  };
  removePiSkill: {
    params: { installedPath: string; projectPath?: string | null };
    response: PiSkillMutationResult;
  };
  startSkillCreatorSession: {
    params: { prompt: string; local?: boolean; projectPath?: string | null };
    response: SkillCreatorSessionState;
  };
  continueSkillCreatorSession: {
    params: { sessionId: string; prompt: string };
    response: SkillCreatorSessionState;
  };
  closeSkillCreatorSession: {
    params: { sessionId: string };
    response: { ok: boolean };
  };
  pickComposerAttachments: {
    params: { projectId?: string | null };
    response: ComposerAttachment[];
  };
  readClipboardSnapshot: {
    params: { formats?: string[] | null };
    response: DesktopClipboardSnapshot;
  };
  readClipboardFilePaths: {
    params: Record<string, never>;
    response: DesktopClipboardFilePaths;
  };
  listComposerAttachmentEntries: {
    params: { projectId?: string | null; path?: string | null; rootPath?: string | null };
    response: ComposerFilePickerState;
  };
  getComposerState: { params: ComposerStateRequest; response: ComposerState };
  getDictationState: { params: Record<string, never>; response: DictationState };
  listDictationModels: { params: Record<string, never>; response: DictationModelSummary[] };
  installDictationModel: {
    params: { modelId: "tiny.en" | "base.en" | "small.en" };
    response: DictationModelInstallResult;
  };
  removeDictationModel: {
    params: { modelId: "tiny.en" | "base.en" | "small.en" };
    response: DictationModelRemoveResult;
  };
  transcribeDictation: {
    params: DictationTranscriptionRequest;
    response: DictationTranscriptionResult;
  };
  getProjectThreads: { params: { projectId: string }; response: Thread[] };
  getInboxThreads: { params: Record<string, never>; response: InboxThread[] };
  getArchivedThreads: { params: Record<string, never>; response: ArchivedThread[] };
  getThread: {
    params: { sessionPath: string; historyCompactions?: number };
    response: ThreadData | null;
  };
  watchSession: { params: { sessionPath: string | null }; response: { ok: boolean } };
  invokeAction: {
    params: { action: DesktopAction; payload?: AnyDesktopActionPayload };
    response: DesktopActionResult;
  };
  listTerminals: { params: Record<string, never>; response: TerminalSessionSnapshot[] };
  terminalOpen: { params: TerminalOpenRequest; response: TerminalSessionSnapshot };
  terminalWrite: { params: TerminalWriteRequest; response: { ok: boolean } };
  terminalResize: { params: TerminalResizeRequest; response: { ok: boolean } };
  terminalClose: { params: TerminalCloseRequest; response: { ok: boolean } };
  openExternal: { params: { url: string }; response: { ok: boolean } };
  openPath: { params: { path: string }; response: { ok: boolean } };
};

export type DesktopEventMap = {
  desktopEvent: DesktopEvent;
  terminalEvent: TerminalEvent;
};

export type DesktopRequestChannel = keyof DesktopRequestMap;
export type DesktopEventChannel = keyof DesktopEventMap;

export type DesktopRequestHandlerMap = {
  [K in DesktopRequestChannel]: (
    params: DesktopRequestMap[K]["params"],
  ) => Promise<DesktopRequestMap[K]["response"]> | DesktopRequestMap[K]["response"];
};

export function getDesktopRequestIpcChannel(channel: DesktopRequestChannel) {
  return `howcode:request:${channel}`;
}

export function getDesktopEventIpcChannel(channel: DesktopEventChannel) {
  return `howcode:event:${channel}`;
}
