import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { DesktopAction } from "../../shared/desktop-actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  DesktopActionResult,
  DesktopEvent,
  InboxThread,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ProjectCommitEntry,
  ProjectDiffResult,
  ProjectGitState,
  ShellState,
  SkillCreatorSessionState,
  Thread,
  ThreadData,
  TurnDiffResult,
} from "../../shared/desktop-contracts";
import type { PiDesktopRpc } from "../../shared/electrobun-rpc";
import type { TerminalEvent, TerminalSessionSnapshot } from "../../shared/terminal-contracts";
import {
  getAttachmentKind,
  isSafeExternalUrl,
  listComposerAttachmentEntries,
  normalizeDialogFilePaths,
} from "./composer-attachments";
import { piSkills, piThreads, skillCreator, terminalManager } from "./desktop-runtime-modules";
import { getMainViewUrl } from "./main-view-url";

if (process.platform === "linux" && !process.env.WEBKIT_DISABLE_DMABUF_RENDERER) {
  process.env.WEBKIT_DISABLE_DMABUF_RENDERER = "1";
}

const rpc = BrowserView.defineRPC<PiDesktopRpc>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {
      getShellState: async () => piThreads.loadShellState(process.cwd()) as Promise<ShellState>,
      getProjectGitState: async ({ projectId }) =>
        (await piThreads.loadProjectGitState(projectId)) as ProjectGitState | null,
      getProjectDiff: async ({ projectId, baseline }) =>
        (await piThreads.loadProjectDiff(projectId, baseline ?? null)) as ProjectDiffResult | null,
      captureProjectDiffBaseline: async ({ projectId }) => {
        await piThreads.captureProjectDiffBaseline(projectId);
        return { ok: true };
      },
      listProjectCommits: async ({ projectId, limit }) =>
        piThreads.listProjectCommits(projectId, limit ?? null) as Promise<ProjectCommitEntry[]>,
      searchPiPackages: async (request) =>
        piThreads.searchPiPackages(request) as Promise<PiPackageCatalogPage>,
      getConfiguredPiPackages: async (request) =>
        piThreads.listConfiguredPiPackages(request) as Promise<PiConfiguredPackage[]>,
      installPiPackage: async (request) =>
        piThreads.installPiPackage(request) as Promise<PiPackageMutationResult>,
      removePiPackage: async (request) =>
        piThreads.removePiPackage(request) as Promise<PiPackageMutationResult>,
      searchPiSkills: async (request) =>
        piSkills.searchPiSkills(request) as Promise<PiSkillCatalogPage>,
      getConfiguredPiSkills: async (request) =>
        piSkills.listConfiguredPiSkills(request) as Promise<PiConfiguredSkill[]>,
      installPiSkill: async (request) =>
        piSkills.installPiSkill(request) as Promise<PiSkillMutationResult>,
      removePiSkill: async (request) =>
        piSkills.removePiSkill(request) as Promise<PiSkillMutationResult>,
      startSkillCreatorSession: async (request) =>
        skillCreator.startSkillCreatorSession(request) as Promise<SkillCreatorSessionState>,
      continueSkillCreatorSession: async (request) =>
        skillCreator.continueSkillCreatorSession(request) as Promise<SkillCreatorSessionState>,
      closeSkillCreatorSession: async (request) =>
        skillCreator.closeSkillCreatorSession(request) as Promise<{ ok: boolean }>,
      pickComposerAttachments: async ({ projectId }) => {
        const filePaths = await Utils.openFileDialog({
          startingFolder: projectId ?? process.cwd(),
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });

        const normalizedFilePaths = await normalizeDialogFilePaths(filePaths);

        return normalizedFilePaths
          .filter((filePath) => filePath.length > 0)
          .map((filePath) => ({
            path: filePath,
            name: filePath.split(/[\\/]/).pop() ?? filePath,
            kind: getAttachmentKind(filePath),
          })) as ComposerAttachment[];
      },
      listComposerAttachmentEntries: async (request) =>
        listComposerAttachmentEntries(request) as Promise<ComposerFilePickerState>,
      getComposerState: async (request) =>
        piThreads.loadComposerState(request) as Promise<ComposerState>,
      getProjectThreads: async ({ projectId }) =>
        piThreads.loadProjectThreads(projectId) as Promise<Thread[]>,
      getInboxThreads: async () => piThreads.loadInboxThreadList() as Promise<InboxThread[]>,
      getArchivedThreads: async () =>
        piThreads.loadArchivedThreadList() as Promise<ArchivedThread[]>,
      getThread: async ({ sessionPath, historyCompactions = 0 }) =>
        piThreads.loadThread(sessionPath, { historyCompactions }) as Promise<ThreadData | null>,
      watchSession: async ({ sessionPath }) => {
        await piThreads.setWatchedSessionPath(sessionPath);
        return { ok: true };
      },
      getTurnDiff: async ({ sessionPath, checkpointTurnCount }) =>
        piThreads.loadTurnDiff(sessionPath, checkpointTurnCount) as Promise<TurnDiffResult | null>,
      getFullThreadDiff: async ({ sessionPath }) =>
        piThreads.loadFullThreadDiff(sessionPath) as Promise<TurnDiffResult | null>,
      invokeAction: async ({ action, payload = {} }) => {
        try {
          const result = await piThreads.handleDesktopAction(action, payload);
          return {
            ok: true,
            at: new Date().toISOString(),
            payload: { action, payload },
            result: result ?? null,
          } as DesktopActionResult;
        } catch (error) {
          console.error("invokeAction failed", { action, payload, error });
          return {
            ok: false,
            at: new Date().toISOString(),
            payload: { action, payload },
            result: {
              error: error instanceof Error ? error.message : "Desktop action failed unexpectedly.",
            },
          } as DesktopActionResult;
        }
      },
      terminalOpen: async (request) =>
        terminalManager.openTerminal(request) as Promise<TerminalSessionSnapshot>,
      terminalWrite: async ({ sessionId, data }) => {
        await terminalManager.writeTerminal(sessionId, data);
        return { ok: true };
      },
      terminalResize: async (request) => {
        await terminalManager.resizeTerminal(request.sessionId, request.cols, request.rows);
        return { ok: true };
      },
      terminalClose: async (request) => {
        await terminalManager.closeTerminal(request);
        return { ok: true };
      },
      openExternal: async ({ url }) => ({
        ok: isSafeExternalUrl(url) ? Utils.openExternal(url) : false,
      }),
      openPath: async ({ path }) => ({ ok: Utils.openPath(path) }),
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: "Pi Desktop Mock",
  url: await getMainViewUrl(),
  rpc,
  frame: {
    width: 1480,
    height: 980,
    x: 120,
    y: 80,
  },
});

piThreads.subscribeDesktopEvents((event: DesktopEvent) => {
  mainWindow.webview.rpc?.send?.desktopEvent(event);
});

terminalManager.subscribeTerminalEvents((event: TerminalEvent) => {
  mainWindow.webview.rpc?.send?.terminalEvent(event);
});
