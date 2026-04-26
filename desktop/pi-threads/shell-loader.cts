import { createReadStream } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
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
  getComposerSlashCommands,
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
const inFlightShellIndexSyncs = new Map<string, Promise<boolean>>();

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
    timestamp?: number;
    content?: string | Array<{ type?: string; text?: string }>;
  };
  name?: string;
};

type SessionSummaryReadResult = {
  summary: SessionSummary | null;
  failed: boolean;
};

type SessionIndexReadResult = {
  sessions: SessionSummary[];
  partialFailure: boolean;
};

type ShellIndexSyncResult = {
  complete: boolean;
  didSync: boolean;
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

function getEntryTimestampMs(entry: SessionFileEntry) {
  if (typeof entry.message?.timestamp === "number") {
    return entry.message.timestamp;
  }

  if (typeof entry.timestamp !== "string") {
    return null;
  }

  const timestampMs = Date.parse(entry.timestamp);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

function getSessionModifiedDate(
  header: SessionFileEntry,
  lastActivityTimeMs: number | null,
  fileModified: Date,
) {
  if (lastActivityTimeMs !== null) {
    return new Date(lastActivityTimeMs);
  }

  const headerTimestampMs =
    typeof header.timestamp === "string" ? Date.parse(header.timestamp) : Number.NaN;
  return Number.isNaN(headerTimestampMs) ? fileModified : new Date(headerTimestampMs);
}

async function readSessionSummary(filePath: string): Promise<SessionSummaryReadResult> {
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return { summary: null, failed: false };
    }

    console.warn(`Failed to stat session file while refreshing shell index: ${filePath}`, error);
    return { summary: null, failed: true };
  }

  let header: SessionFileEntry | undefined;
  let firstMessage: string | undefined;
  let name: string | undefined;
  let lastActivityTimeMs: number | null = null;

  try {
    const lines = createInterface({
      input: createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let entry: SessionFileEntry;
      try {
        entry = JSON.parse(line) as SessionFileEntry;
      } catch {
        continue;
      }

      header ??= entry;

      if (entry.type === "session_info") {
        name = entry.name?.trim() || undefined;
      }

      if (!firstMessage && entry.type === "message" && entry.message?.role === "user") {
        firstMessage = getMessageText(entry) || undefined;
      }

      if (
        entry.type === "message" &&
        (entry.message?.role === "user" || entry.message?.role === "assistant")
      ) {
        const entryTimestampMs = getEntryTimestampMs(entry);
        if (entryTimestampMs !== null) {
          lastActivityTimeMs = Math.max(lastActivityTimeMs ?? 0, entryTimestampMs);
        }
      }
    }
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return { summary: null, failed: false };
    }

    console.warn(`Failed to read session file while refreshing shell index: ${filePath}`, error);
    return { summary: null, failed: true };
  }

  if (!header || header.type !== "session" || typeof header.id !== "string") {
    console.warn(`Invalid session header while refreshing shell index: ${filePath}`);
    return { summary: null, failed: true };
  }

  return {
    summary: {
      id: header.id,
      cwd: typeof header.cwd === "string" ? header.cwd : undefined,
      path: filePath,
      name,
      firstMessage,
      modified: getSessionModifiedDate(header, lastActivityTimeMs, fileStat.mtime),
    },
    failed: false,
  };
}

async function listAllSessionsStrict(): Promise<SessionIndexReadResult> {
  const { getAgentDir } = await getPiModule();
  const sessionsDir = path.join(getAgentDir(), "sessions");
  const sessionDirectories = (await readDirectoryIfPresent(sessionsDir)).filter((entry) =>
    entry.isDirectory(),
  );
  const sessionFilePaths: string[] = [];

  const sessionDirectoryResults = await Promise.all(
    sessionDirectories.map(async (sessionDirectory) => {
      const sessionDirectoryPath = path.join(sessionsDir, sessionDirectory.name);

      let sessionFiles: Awaited<ReturnType<typeof readDirectoryIfPresent>>;
      try {
        sessionFiles = await readDirectoryIfPresent(sessionDirectoryPath);
      } catch (error) {
        console.warn(
          `Failed to read session directory while refreshing shell index: ${sessionDirectoryPath}`,
          error,
        );
        return { filePaths: [], failed: true };
      }

      return {
        filePaths: sessionFiles
          .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
          .map((entry) => path.join(sessionDirectoryPath, entry.name)),
        failed: false,
      };
    }),
  );

  let partialFailure = sessionDirectoryResults.some((result) => result.failed);
  for (const result of sessionDirectoryResults) {
    sessionFilePaths.push(...result.filePaths);
  }

  const sessionResults = await Promise.all(sessionFilePaths.map(readSessionSummary));
  const sessions = sessionResults
    .map((result) => result.summary)
    .filter((session): session is SessionSummary => session !== null);
  partialFailure ||= sessionResults.some((result) => result.failed);
  sessions.sort((left, right) => right.modified.getTime() - left.modified.getTime());
  return { sessions, partialFailure };
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

async function syncShellIndex(cwd: string): Promise<ShellIndexSyncResult> {
  const { sessions, partialFailure } = await listAllSessionsStrict();

  syncSessionSummaries(
    cwd,
    sessions.map((session) => mapSessionSummaryToRecord(cwd, session)),
  );

  return { complete: !partialFailure, didSync: true };
}

function startShellIndexSync(
  cwd: string,
  options: { emitRefreshEvent?: boolean; warningLabel: string },
) {
  const syncPromise = syncShellIndex(cwd)
    .then((syncResult) => {
      if (syncResult.complete) {
        syncedShellIndexes.add(cwd);
      }

      if (syncResult.didSync && (options.emitRefreshEvent ?? true)) {
        emitDesktopEvent({ type: "shell-state-refresh" });
      }

      return syncResult.complete;
    })
    .catch((error) => {
      console.warn(options.warningLabel, error);
      return false;
    })
    .finally(() => {
      inFlightShellIndexSyncs.delete(cwd);
    });

  inFlightShellIndexSyncs.set(cwd, syncPromise);
  return syncPromise;
}

function scheduleShellIndexSync(cwd: string) {
  if (syncedShellIndexes.has(cwd) || inFlightShellIndexSyncs.has(cwd)) {
    return;
  }

  void startShellIndexSync(cwd, { warningLabel: "Failed to sync shell index." });
}

export async function refreshShellIndex(
  cwd: string,
  options: { emitRefreshEvent?: boolean; force?: boolean } = {},
) {
  const inFlightSync = inFlightShellIndexSyncs.get(cwd);
  if (inFlightSync && !options.force) {
    return await inFlightSync;
  }

  if (inFlightSync) {
    // User-triggered project import needs a fresh filesystem pass. The background
    // startup sync may have snapshotted sessions before a Pi CLI project was created.
    await inFlightSync;

    const forcedInFlightSync = inFlightShellIndexSyncs.get(cwd);
    if (forcedInFlightSync) {
      return await forcedInFlightSync;
    }
  }

  return await startShellIndexSync(cwd, {
    emitRefreshEvent: options.emitRefreshEvent,
    warningLabel: "Failed to refresh shell index.",
  });
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

export async function loadComposerSlashCommands(request: ComposerStateRequest = {}) {
  return getComposerSlashCommands(request);
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
