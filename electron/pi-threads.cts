import { stat, unlink } from "node:fs/promises";
import type { DesktopAction } from "../shared/desktop-actions.js";
import type {
  ArchivedThread,
  DesktopActionPayload,
  Message,
  ShellState,
  Thread,
  ThreadData,
} from "../shared/desktop-contracts.js";
import {
  getComposerState,
  setComposerModel,
  setComposerThinkingLevel,
} from "./pi-desktop-runtime.cjs";
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

type TextPart = {
  type?: string;
  text?: string;
};

type AgentMessageEntry = {
  role: string;
  content: string | TextPart[];
  timestamp?: string | number;
};

type BranchEntry = {
  type: string;
  message: AgentMessageEntry;
};

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

function normalizeThreadTitle(value: unknown) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "New thread";
  }

  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function extractTextContent(content: AgentMessageEntry["content"]) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function mapAgentMessageToUiMessage(entry: AgentMessageEntry, index: number): Message | null {
  if (entry.role === "user") {
    const text = extractTextContent(entry.content);
    if (!text) {
      return null;
    }

    return {
      id: `${entry.timestamp ?? index}-user-${index}`,
      role: "user",
      content: [text],
    };
  }

  if (entry.role === "assistant") {
    const paragraphs = Array.isArray(entry.content)
      ? entry.content
          .filter((part) => part?.type === "text" && typeof part.text === "string")
          .flatMap((part) => splitParagraphs(part.text ?? ""))
      : [];

    if (paragraphs.length === 0) {
      return null;
    }

    return {
      id: `${entry.timestamp ?? index}-assistant-${index}`,
      role: "assistant",
      content: paragraphs,
    };
  }

  return null;
}

function getFirstUserTurnTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  return normalizeThreadTitle(firstUserMessage?.content[0]);
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

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { SessionManager } = await getPiModule();
  const { agentDir, sessionDir } = await getSessionStorage(cwd);

  await syncShellIndex(cwd);
  const composer = await getComposerState(cwd);

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

export async function loadProjectThreads(projectId: string): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const cachedThread = getCachedThread(sessionPath);
  const fileStats = await stat(sessionPath);
  const currentModifiedMs = Math.floor(fileStats.mtimeMs);

  if (
    cachedThread?.messages &&
    cachedThread.hydratedModifiedMs !== null &&
    cachedThread.hydratedModifiedMs >= currentModifiedMs
  ) {
    return {
      sessionPath,
      title: cachedThread.title,
      messages: cachedThread.messages,
      previousMessageCount: 0,
    };
  }

  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const branchEntries = manager.getBranch() as BranchEntry[];
  const messages = branchEntries
    .filter((entry) => entry.type === "message")
    .map((entry, index) => mapAgentMessageToUiMessage(entry.message, index))
    .filter((entry): entry is Message => entry !== null);

  const title = cachedThread?.title || getFirstUserTurnTitle(messages);
  saveThreadCache(sessionPath, title, messages, currentModifiedMs);

  return {
    sessionPath,
    title,
    messages,
    previousMessageCount: 0,
  };
}

export async function handleDesktopAction(
  action: DesktopAction,
  payload: DesktopActionPayload,
): Promise<void> {
  switch (action) {
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

    case "composer.model": {
      const provider = typeof payload.provider === "string" ? payload.provider : null;
      const modelId = typeof payload.modelId === "string" ? payload.modelId : null;

      if (provider && modelId) {
        await setComposerModel(process.cwd(), provider, modelId);
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
        await setComposerThinkingLevel(process.cwd(), level);
      }
      return;
    }

    default:
      return;
  }
}
