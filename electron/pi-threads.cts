import { stat, unlink } from "node:fs/promises";
import type { DesktopAction } from "../shared/desktop-actions.js";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  DesktopActionPayload,
  ShellState,
  Thread,
  ThreadData,
} from "../shared/desktop-contracts.js";
import {
  getComposerState,
  getLiveThread,
  openThreadRuntime,
  selectProjectRuntime,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  startNewThread,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from "./pi-desktop-runtime.cjs";
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
  normalizeThreadTitle,
} from "./pi-message-mapper.cjs";
import {
  archiveThread,
  collapseAllProjects,
  deleteThreadRecord,
  ensureProject,
  getCachedThread,
  getThreadSessionPath,
  listArchivedThreads,
  listProjectThreads,
  listProjects,
  restoreThread,
  saveThreadCache,
  setProjectCollapsed,
  syncSessionSummaries,
  toggleThreadPinned,
} from "./thread-state-db.cjs";

type PiModule = typeof import("@mariozechner/pi-coding-agent");

type SessionSummary = {
  id: string;
  name?: string;
  firstMessage?: string;
  modified: Date;
  path: string;
  cwd?: string;
};

type SessionStorage = {
  agentDir: string;
  sessionDir: string | null;
};

let piModulePromise: Promise<PiModule> | undefined;

function getPiModule() {
  if (!piModulePromise) {
    piModulePromise = import("@mariozechner/pi-coding-agent");
  }

  return piModulePromise;
}

function mapSessionSummaryToRecord(cwd: string, session: SessionSummary) {
  return {
    id: session.id,
    cwd: session.cwd || cwd,
    sessionPath: session.path,
    title: normalizeThreadTitle(session.firstMessage || session.name),
    lastModifiedMs: session.modified.getTime(),
  };
}

async function getSessionStorage(cwd: string): Promise<SessionStorage> {
  const { SettingsManager, getAgentDir } = await getPiModule();
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const configuredSessionDir = settingsManager.getSessionDir();

  return {
    agentDir,
    sessionDir: configuredSessionDir ?? null,
  };
}

async function syncShellIndex(cwd: string) {
  const { SessionManager } = await getPiModule();
  const sessions = (await SessionManager.listAll()) as SessionSummary[];
  syncSessionSummaries(
    cwd,
    sessions.map((session) => mapSessionSummaryToRecord(cwd, session)),
  );
}

function getComposerRequest(payload: DesktopActionPayload): ComposerStateRequest {
  return {
    projectId: typeof payload.projectId === "string" ? payload.projectId : null,
    sessionPath: typeof payload.sessionPath === "string" ? payload.sessionPath : null,
  };
}

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { SessionManager } = await getPiModule();
  const { agentDir, sessionDir } = await getSessionStorage(cwd);

  await syncShellIndex(cwd);
  const composer = await getComposerState({ projectId: cwd });

  return {
    platform: process.platform,
    mockMode: false,
    productName: "Pi Desktop Mock",
    cwd,
    agentDir,
    sessionDir: sessionDir ?? SessionManager.create(cwd).getSessionDir(),
    availableHosts: ["Local"],
    composerProfiles: ["Pi session"],
    composer,
    projects: listProjects(cwd),
  };
}

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request);
}

export const subscribeDesktopEvents = subscribeRuntimeEvents;

export async function loadProjectThreads(projectId: string): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread) {
    return liveThread;
  }

  const cachedThread = getCachedThread(sessionPath);
  const fileStats = await stat(sessionPath);
  const currentModifiedMs = Math.floor(fileStats.mtimeMs);
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const branchEntries = manager.getBranch();
  const previousMessageCount = getPreviousMessageCount(branchEntries);

  if (
    cachedThread?.messages &&
    cachedThread.hydratedModifiedMs !== null &&
    cachedThread.hydratedModifiedMs >= currentModifiedMs
  ) {
    return {
      sessionPath,
      title: cachedThread.title,
      messages: cachedThread.messages,
      previousMessageCount,
      isStreaming: false,
    };
  }

  const sessionContext = manager.buildSessionContext();
  const messages = mapAgentMessagesToUiMessages(sessionContext.messages);

  const title = cachedThread?.title || getFirstUserTurnTitle(messages);
  saveThreadCache(sessionPath, title, messages, currentModifiedMs);

  return {
    sessionPath,
    title,
    messages,
    previousMessageCount,
    isStreaming: false,
  };
}

export async function handleDesktopAction(
  action: DesktopAction,
  payload: DesktopActionPayload,
): Promise<void> {
  switch (action) {
    case "project.select": {
      await selectProjectRuntime(getComposerRequest(payload));
      return;
    }

    case "project.expand": {
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (projectId) {
        setProjectCollapsed(projectId, false);
      }
      return;
    }

    case "project.collapse": {
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (projectId) {
        setProjectCollapsed(projectId, true);
      }
      return;
    }

    case "threads.collapse-all":
      collapseAllProjects();
      return;

    case "thread.pin": {
      const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
      if (threadId) {
        toggleThreadPinned(threadId);
      }
      return;
    }

    case "thread.open": {
      await openThreadRuntime(getComposerRequest(payload));
      return;
    }

    case "thread.archive": {
      const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
      if (threadId) {
        archiveThread(threadId);
      }
      return;
    }

    case "thread.restore": {
      const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
      if (threadId) {
        restoreThread(threadId);
      }
      return;
    }

    case "thread.delete": {
      const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
      if (!threadId) {
        return;
      }

      const sessionPath = getThreadSessionPath(threadId);
      if (sessionPath) {
        try {
          await unlink(sessionPath);
        } catch (error) {
          if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== "ENOENT"
          ) {
            throw error;
          }
        }
      }
      deleteThreadRecord(threadId);
      return;
    }

    case "thread.new": {
      await startNewThread(getComposerRequest(payload));
      return;
    }

    case "composer.model": {
      const provider = typeof payload.provider === "string" ? payload.provider : null;
      const modelId = typeof payload.modelId === "string" ? payload.modelId : null;

      if (provider && modelId) {
        await setComposerModel(getComposerRequest(payload), provider, modelId);
      }
      return;
    }

    case "composer.thinking": {
      const level = typeof payload.level === "string" ? payload.level : null;

      if (
        level === "off" ||
        level === "minimal" ||
        level === "low" ||
        level === "medium" ||
        level === "high" ||
        level === "xhigh"
      ) {
        await setComposerThinkingLevel(getComposerRequest(payload), level);
      }
      return;
    }

    case "composer.send": {
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      const attachments = Array.isArray(payload.attachments)
        ? payload.attachments.filter(
            (attachment): attachment is ComposerAttachment =>
              typeof attachment === "object" &&
              attachment !== null &&
              typeof attachment.path === "string" &&
              typeof attachment.name === "string" &&
              (attachment.kind === "text" || attachment.kind === "image"),
          )
        : [];

      if (!text) {
        return;
      }

      await sendComposerPrompt({ ...getComposerRequest(payload), text, attachments });
      return;
    }

    default:
      return;
  }
}
