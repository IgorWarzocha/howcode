import { getDesktopWorkingDirectory } from "../../../../../shared/desktop-working-directory";
import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";
import type { PiThreadsModule } from "../../runtime/desktop-runtime-contracts";

type PiThreadsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | "getShellState"
  | "getProjectGitState"
  | "getProjectDiff"
  | "getProjectDiffStats"
  | "captureProjectDiffBaseline"
  | "listProjectCommits"
  | "getComposerState"
  | "getDictationState"
  | "listDictationModels"
  | "installDictationModel"
  | "removeDictationModel"
  | "transcribeDictation"
  | "getProjectThreads"
  | "getInboxThreads"
  | "getArchivedThreads"
  | "getThread"
  | "watchSession"
  | "invokeAction"
>;

export function createPiThreadsHandlers(piThreads: PiThreadsModule): PiThreadsRequestHandlers {
  return {
    getShellState: async () => piThreads.loadShellState(getDesktopWorkingDirectory()),
    getProjectGitState: ({ projectId }) => piThreads.loadProjectGitState(projectId),
    getProjectDiff: ({ projectId, baseline }) =>
      piThreads.loadProjectDiff(projectId, baseline ?? null),
    getProjectDiffStats: ({ projectId, baseline }) =>
      piThreads.loadProjectDiffStats(projectId, baseline ?? null),
    captureProjectDiffBaseline: ({ projectId }) => piThreads.captureProjectDiffBaseline(projectId),
    listProjectCommits: ({ projectId, limit }) =>
      piThreads.listProjectCommits(projectId, limit ?? null),
    getComposerState: (request) => piThreads.loadComposerState(request),
    getDictationState: () => piThreads.getDictationState(),
    listDictationModels: () => piThreads.listDictationModels(),
    installDictationModel: (request) => piThreads.installDictationModel(request),
    removeDictationModel: (request) => piThreads.removeDictationModel(request),
    transcribeDictation: (request) => piThreads.transcribeDictation(request),
    getProjectThreads: ({ projectId }) => piThreads.loadProjectThreads(projectId),
    getInboxThreads: () => piThreads.loadInboxThreadList(),
    getArchivedThreads: () => piThreads.loadArchivedThreadList(),
    getThread: ({ sessionPath, historyCompactions = 0 }) =>
      piThreads.loadThread(sessionPath, { historyCompactions }),
    watchSession: async ({ sessionPath }) => {
      await piThreads.setWatchedSessionPath(sessionPath);
      return { ok: true };
    },
    invokeAction: async ({ action, payload = {} }) => {
      try {
        const result = await piThreads.handleDesktopAction(action, payload);
        return {
          ok: true,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: result ?? null,
        };
      } catch (error) {
        console.error("invokeAction failed", { action, payload, error });
        return {
          ok: false,
          at: new Date().toISOString(),
          payload: { action, payload },
          result: {
            error: error instanceof Error ? error.message : "Desktop action failed unexpectedly.",
          },
        };
      }
    },
  };
}
