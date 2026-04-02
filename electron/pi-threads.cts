import os from "node:os";
import path from "node:path";
import type { Message, Project, ShellState, ThreadData } from "../shared/desktop-contracts.js";

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

function formatRelativeAge(date: Date) {
  const elapsedMs = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < hour) {
    return `${Math.max(1, Math.floor(elapsedMs / minute))}m`;
  }

  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}h`;
  }

  if (elapsedMs < week) {
    return `${Math.floor(elapsedMs / day)}d`;
  }

  if (elapsedMs < month) {
    return `${Math.floor(elapsedMs / week)}w`;
  }

  if (elapsedMs < year) {
    return `${Math.floor(elapsedMs / month)}mo`;
  }

  return `${Math.floor(elapsedMs / year)}y`;
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

function createProjectFromSessions(cwd: string, sessions: SessionSummary[]): Project {
  return {
    id: cwd,
    name: path.basename(cwd) || cwd,
    threads: sessions.map((session) => ({
      id: session.id,
      title: normalizeThreadTitle(session.name || session.firstMessage),
      age: formatRelativeAge(session.modified),
      sessionPath: session.path,
    })),
  };
}

function groupSessionsByCwd(cwd: string, sessions: SessionSummary[]) {
  const projectsByCwd = new Map<string, SessionSummary[]>();

  for (const session of sessions) {
    const sessionCwd = session.cwd || cwd;
    const existing = projectsByCwd.get(sessionCwd) || [];
    existing.push(session);
    projectsByCwd.set(sessionCwd, existing);
  }

  if (!projectsByCwd.has(cwd)) {
    projectsByCwd.set(cwd, []);
  }

  return Array.from(projectsByCwd.entries())
    .map(([projectCwd, projectSessions]) => ({
      project: createProjectFromSessions(
        projectCwd,
        [...projectSessions].sort((a, b) => b.modified.getTime() - a.modified.getTime()),
      ),
      latestModified: projectSessions[0]?.modified?.getTime() ?? 0,
      isCurrent: projectCwd === cwd,
    }))
    .sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) {
        return -1;
      }

      if (!a.isCurrent && b.isCurrent) {
        return 1;
      }

      return b.latestModified - a.latestModified;
    })
    .map((entry) => entry.project);
}

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { SessionManager } = await getPiModule();
  const { agentDir, sessionDir } = await getSessionStorage(cwd);
  const sessions = (await SessionManager.listAll()) as SessionSummary[];

  return {
    platform: process.platform,
    mockMode: false,
    productName: "Pi Desktop Mock",
    cwd,
    agentDir,
    sessionDir: sessionDir ?? SessionManager.create(cwd).getSessionDir(),
    availableHosts: ["Local"],
    composerProfiles: ["Pi session"],
    projects: groupSessionsByCwd(cwd, sessions),
  };
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const branchEntries = manager.getBranch() as BranchEntry[];
  const messages = branchEntries
    .filter((entry) => entry.type === "message")
    .map((entry, index) => mapAgentMessageToUiMessage(entry.message, index))
    .filter((entry): entry is Message => entry !== null);

  return {
    sessionPath,
    title: normalizeThreadTitle(manager.getSessionName() || messages[0]?.content?.[0]),
    messages,
    previousMessageCount: 0,
  };
}
