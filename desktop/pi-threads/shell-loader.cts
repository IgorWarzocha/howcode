import { realpath } from "node:fs/promises";
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
  const { SessionManager } = await getPiModule();
  const sessions = (await SessionManager.listAll()) as SessionSummary[];

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
