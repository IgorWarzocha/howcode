import Electrobun, { Electroview } from "electrobun/view";
import type { PiDesktopRpc } from "../../../shared/electrobun-rpc.js";
import type { DesktopAction } from "./actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopEvent,
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
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  Thread,
  ThreadData,
} from "./types";

const desktopListeners = new Set<(event: DesktopEvent) => void>();
const terminalListeners = new Set<(event: TerminalEvent) => void>();

const rpc = Electroview.defineRPC<PiDesktopRpc>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {},
    messages: {
      desktopEvent: (event) => {
        for (const listener of desktopListeners) {
          listener(event);
        }
      },
      terminalEvent: (event) => {
        for (const listener of terminalListeners) {
          listener(event);
        }
      },
    },
  },
});

let electrobun: InstanceType<typeof Electrobun.Electroview<typeof rpc>> | null = null;

function hasElectrobunGlobals() {
  return (
    typeof window.__electrobunWebviewId === "number" &&
    typeof window.__electrobunRpcSocketPort === "number"
  );
}

async function waitForElectrobunGlobals(timeoutMs = 3_000) {
  const startedAt = Date.now();

  while (!hasElectrobunGlobals()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Electrobun RPC globals are unavailable.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

async function getElectroview() {
  await waitForElectrobunGlobals();

  if (!electrobun) {
    electrobun = new Electrobun.Electroview({ rpc });
  }

  return electrobun;
}

async function getRpc() {
  const bridge = (await getElectroview()).rpc;
  if (!bridge) {
    throw new Error("Electrobun RPC bridge is unavailable.");
  }

  return bridge;
}

export const piDesktopApi = {
  getShellState: async () => (await getRpc()).request.getShellState({}) as Promise<ShellState>,
  getProjectGitState: async (projectId: string) =>
    (await getRpc()).request.getProjectGitState({ projectId }) as Promise<ProjectGitState | null>,
  getProjectDiff: async (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    (await getRpc()).request.getProjectDiff({
      projectId,
      baseline,
    }) as Promise<ProjectDiffResult | null>,
  getProjectDiffStats: async (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    (await getRpc()).request.getProjectDiffStats({
      projectId,
      baseline,
    }) as Promise<ProjectDiffStatsResult | null>,
  captureProjectDiffBaseline: async (projectId: string) =>
    (await getRpc()).request.captureProjectDiffBaseline({
      projectId,
    }) as Promise<ProjectDiffResolvedBaseline | null>,
  listProjectCommits: async (projectId: string, limit: number | null = null) =>
    (await getRpc()).request.listProjectCommits({ projectId, limit }) as Promise<
      ProjectCommitEntry[]
    >,
  searchPiPackages: async (
    request: { query?: string | null; cursor?: number | null; pageSize?: number | null } = {},
  ) => (await getRpc()).request.searchPiPackages(request) as Promise<PiPackageCatalogPage>,
  getConfiguredPiPackages: async (request: { projectPath?: string | null } = {}) =>
    (await getRpc()).request.getConfiguredPiPackages(request) as Promise<PiConfiguredPackage[]>,
  installPiPackage: async (request: {
    source: string;
    kind?: "npm" | "git";
    local?: boolean;
    projectPath?: string | null;
  }) => (await getRpc()).request.installPiPackage(request) as Promise<PiPackageMutationResult>,
  removePiPackage: async (request: {
    source: string;
    local?: boolean;
    projectPath?: string | null;
  }) => (await getRpc()).request.removePiPackage(request) as Promise<PiPackageMutationResult>,
  searchPiSkills: async (request: { query?: string | null; limit?: number | null } = {}) =>
    (await getRpc()).request.searchPiSkills(request) as Promise<PiSkillCatalogPage>,
  getConfiguredPiSkills: async (request: { projectPath?: string | null } = {}) =>
    (await getRpc()).request.getConfiguredPiSkills(request) as Promise<PiConfiguredSkill[]>,
  installPiSkill: async (request: {
    source: string;
    local?: boolean;
    projectPath?: string | null;
  }) => (await getRpc()).request.installPiSkill(request) as Promise<PiSkillMutationResult>,
  removePiSkill: async (request: { installedPath: string; projectPath?: string | null }) =>
    (await getRpc()).request.removePiSkill(request) as Promise<PiSkillMutationResult>,
  startSkillCreatorSession: async (request: {
    prompt: string;
    local?: boolean;
    projectPath?: string | null;
  }) =>
    (await getRpc()).request.startSkillCreatorSession(request) as Promise<SkillCreatorSessionState>,
  continueSkillCreatorSession: async (request: { sessionId: string; prompt: string }) =>
    (await getRpc()).request.continueSkillCreatorSession(
      request,
    ) as Promise<SkillCreatorSessionState>,
  closeSkillCreatorSession: async (sessionId: string) =>
    (await getRpc()).request.closeSkillCreatorSession({ sessionId }) as Promise<{ ok: boolean }>,
  pickComposerAttachments: async (projectId: string | null = null) =>
    (await getRpc()).request.pickComposerAttachments({
      projectId,
    }) as Promise<ComposerAttachment[]>,
  listComposerAttachmentEntries: async (
    request: {
      projectId?: string | null;
      path?: string | null;
      rootPath?: string | null;
    } = {},
  ) =>
    (await getRpc()).request.listComposerAttachmentEntries(
      request,
    ) as Promise<ComposerFilePickerState>,
  getComposerState: async (request: ComposerStateRequest = {}) =>
    (await getRpc()).request.getComposerState(request) as Promise<ComposerState>,
  getDictationState: async () =>
    (await getRpc()).request.getDictationState({}) as Promise<DictationState>,
  transcribeDictation: async (request: DictationTranscriptionRequest) =>
    (await getRpc()).request.transcribeDictation(request) as Promise<DictationTranscriptionResult>,
  getProjectThreads: async (projectId: string) =>
    (await getRpc()).request.getProjectThreads({ projectId }) as Promise<Thread[]>,
  getInboxThreads: async () =>
    (await getRpc()).request.getInboxThreads({}) as Promise<InboxThread[]>,
  getArchivedThreads: async () =>
    (await getRpc()).request.getArchivedThreads({}) as Promise<ArchivedThread[]>,
  getThread: async (sessionPath: string, historyCompactions = 0) =>
    (await getRpc()).request.getThread({
      sessionPath,
      historyCompactions,
    }) as Promise<ThreadData | null>,
  watchSession: async (sessionPath: string | null) => {
    await (await getRpc()).request.watchSession({ sessionPath });
  },
  invokeAction: async (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
    (await getRpc()).request.invokeAction({
      action,
      payload,
    }) as Promise<DesktopActionResult>,
  listTerminals: async () =>
    (await getRpc()).request.listTerminals({}) as Promise<TerminalSessionSnapshot[]>,
  openTerminal: async (request: TerminalOpenRequest) =>
    (await getRpc()).request.terminalOpen(request) as Promise<TerminalSessionSnapshot>,
  writeTerminal: async (sessionId: string, data: string) => {
    await (await getRpc()).request.terminalWrite({ sessionId, data });
  },
  resizeTerminal: async (request: TerminalResizeRequest) => {
    await (await getRpc()).request.terminalResize(request);
  },
  closeTerminal: async (request: TerminalCloseRequest) => {
    await (await getRpc()).request.terminalClose(request);
  },
  openExternal: async (url: string) =>
    (await getRpc()).request.openExternal({ url }).then(({ ok }) => ok),
  openPath: async (path: string) =>
    (await getRpc()).request.openPath({ path }).then(({ ok }) => ok),
  subscribe: (listener: (event: DesktopEvent) => void) => {
    desktopListeners.add(listener);
    return () => desktopListeners.delete(listener);
  },
  subscribeTerminal: (listener: (event: TerminalEvent) => void) => {
    terminalListeners.add(listener);
    return () => terminalListeners.delete(listener);
  },
};
