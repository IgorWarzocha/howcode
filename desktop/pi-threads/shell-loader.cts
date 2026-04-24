import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ComposerState,
  ComposerStateRequest,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
  Project,
  ProjectCommitEntry,
  ShellState,
} from "../../shared/desktop-contracts.ts";
import {
  getDictationState as getSherpaDictationState,
  installDictationModel as installSherpaDictationModel,
  listDictationModels as listSherpaDictationModels,
  removeDictationModel as removeSherpaDictationModel,
  transcribeDictation as transcribeSherpaDictation,
} from "../dictation/sherpa-onnx.cts";
import { normalizeThreadTitle } from "../../shared/pi-message-mapper.ts";
import { loadAppSettings } from "../app-settings.cts";
import {
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from "../pi-desktop-runtime.cts";
import { getPiModule } from "../pi-module.cts";
import {
  captureProjectDiffBaseline,
  listProjectCommits,
  loadProjectDiff,
  loadProjectDiffStats,
  loadProjectGitState,
} from "../project-git.cts";
import { emitDesktopEvent } from "../runtime/desktop-events.cts";
import { ensureProject, listProjects, syncSessionSummaries } from "../thread-state-db.cts";
import { setWatchedSessionPath } from "./session-watch.cts";
export { loadInboxThreadList } from "./thread-loader.cts";

const syncedShellIndexes = new Set<string>();
const inFlightShellIndexSyncs = new Map<string, Promise<void>>();

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

type SessionFileEntry = {
  type?: string;
  id?: string;
  timestamp?: string;
  cwd?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type?: string; text?: string }>;
  };
  name?: string;
};

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

function isNodeErrorWithCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function readDirectoryIfPresent(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }
}

function getMessageText(entry: SessionFileEntry) {
  const content = entry.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join(" ");
  }

  return "";
}

async function readSessionSummary(filePath: string): Promise<SessionSummary | null> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }

  const entries = content
    .trim()
    .split("\n")
    .flatMap((line) => {
      if (!line.trim()) {
        return [];
      }

      try {
        return [JSON.parse(line) as SessionFileEntry];
      } catch {
        return [];
      }
    });
  const header = entries[0];
  if (!header || header.type !== "session" || typeof header.id !== "string") {
    return null;
  }

  let firstMessage = "";
  let name: string | undefined;
  for (const entry of entries) {
    if (entry.type === "session_info") {
      name = entry.name?.trim() || undefined;
    }

    if (!firstMessage && entry.type === "message" && entry.message?.role === "user") {
      firstMessage = getMessageText(entry);
    }
  }

  const fileStat = await stat(filePath);
  const headerTimestamp =
    typeof header.timestamp === "string" ? Date.parse(header.timestamp) : Number.NaN;

  return {
    id: header.id,
    cwd: typeof header.cwd === "string" ? header.cwd : undefined,
    path: filePath,
    name,
    firstMessage: firstMessage || "(no messages)",
    modified: Number.isNaN(headerTimestamp) ? fileStat.mtime : new Date(headerTimestamp),
  };
}

async function listAllSessionsStrict(): Promise<SessionSummary[]> {
  const { getAgentDir } = await getPiModule();
  const sessionsDir = path.join(getAgentDir(), "sessions");
  const sessionDirectories = (await readDirectoryIfPresent(sessionsDir)).filter((entry) =>
    entry.isDirectory(),
  );
  const sessionFilePaths: string[] = [];

  for (const sessionDirectory of sessionDirectories) {
    const sessionDirectoryPath = path.join(sessionsDir, sessionDirectory.name);
    const sessionFiles = await readDirectoryIfPresent(sessionDirectoryPath);
    sessionFilePaths.push(
      ...sessionFiles
        .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
        .map((entry) => path.join(sessionDirectoryPath, entry.name)),
    );
  }

  const sessions = (await Promise.all(sessionFilePaths.map(readSessionSummary))).filter(
    (session): session is SessionSummary => session !== null,
  );
  sessions.sort((left, right) => right.modified.getTime() - left.modified.getTime());
  return sessions;
}

async function resolveProjectPathForComparison(projectId: string) {
  const resolvedProjectId = path.resolve(projectId);

  try {
    return await realpath(resolvedProjectId);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code !== "ENOENT"
    ) {
      console.warn(`Failed to resolve project path for shell state: ${resolvedProjectId}`, error);
    }

    return resolvedProjectId;
  }
}

async function enrichProjectsWithResolvedIds(projects: Project[]) {
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      resolvedId: await resolveProjectPathForComparison(project.id),
    })),
  );
}

async function syncShellIndex(cwd: string) {
  const sessions = await listAllSessionsStrict();

  syncSessionSummaries(
    cwd,
    sessions.map((session) => mapSessionSummaryToRecord(cwd, session)),
  );
}

function scheduleShellIndexSync(cwd: string) {
  if (syncedShellIndexes.has(cwd) || inFlightShellIndexSyncs.has(cwd)) {
    return;
  }

  const syncPromise = syncShellIndex(cwd)
    .then(() => {
      syncedShellIndexes.add(cwd);
      emitDesktopEvent({ type: "shell-state-refresh" });
    })
    .catch((error) => {
      console.warn("Failed to sync shell index.", error);
    })
    .finally(() => {
      inFlightShellIndexSyncs.delete(cwd);
    });

  inFlightShellIndexSyncs.set(cwd, syncPromise);
}

export async function refreshShellIndex(cwd: string, options: { emitRefreshEvent?: boolean } = {}) {
  const inFlightSync = inFlightShellIndexSyncs.get(cwd);
  if (inFlightSync) {
    try {
      await inFlightSync;
    } catch (error) {
      console.warn("Failed to wait for shell index sync before refresh.", error);
    }
  }

  try {
    await syncShellIndex(cwd);
    syncedShellIndexes.add(cwd);
    if (options.emitRefreshEvent ?? true) {
      emitDesktopEvent({ type: "shell-state-refresh" });
    }
    return true;
  } catch (error) {
    console.warn("Failed to refresh shell index.", error);
    return false;
  }
}

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { SessionManager } = await getPiModule();
  const { agentDir, sessionDir } = await getSessionStorage(cwd);

  ensureProject(cwd);
  scheduleShellIndexSync(cwd);
  const composer = await getComposerState({ projectId: cwd });
  const appSettings = loadAppSettings();
  const [resolvedCwd, projects] = await Promise.all([
    resolveProjectPathForComparison(cwd),
    enrichProjectsWithResolvedIds(listProjects(cwd)),
  ]);

  return {
    platform: process.platform,
    mockMode: false,
    productName: "Pi Desktop Mock",
    cwd,
    resolvedCwd,
    agentDir,
    sessionDir: sessionDir ?? SessionManager.create(cwd).getSessionDir(),
    appSettings,
    availableHosts: ["Local"],
    composer,
    projects,
  };
}

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request);
}

export async function getDictationState(): Promise<DictationState> {
  return getSherpaDictationState();
}

export async function listDictationModels(): Promise<DictationModelSummary[]> {
  return listSherpaDictationModels();
}

export async function installDictationModel(request: {
  modelId: "tiny.en" | "base.en" | "small.en";
}): Promise<DictationModelInstallResult> {
  return installSherpaDictationModel(request.modelId);
}

export async function removeDictationModel(request: {
  modelId: "tiny.en" | "base.en" | "small.en";
}): Promise<DictationModelRemoveResult> {
  return removeSherpaDictationModel(request.modelId);
}

export async function transcribeDictation(
  request: DictationTranscriptionRequest,
): Promise<DictationTranscriptionResult> {
  return transcribeSherpaDictation(request);
}

export async function loadProjectCommitHistory(
  projectId: string,
  limit?: number | null,
): Promise<ProjectCommitEntry[]> {
  return listProjectCommits(projectId, limit ?? null);
}

export { loadProjectGitState };
export { loadProjectDiff };
export { loadProjectDiffStats };
export { captureProjectDiffBaseline };
export { listProjectCommits };
export { setWatchedSessionPath };

export const subscribeDesktopEvents = subscribeRuntimeEvents;
