import type {
  ComposerState,
  ComposerStateRequest,
  ShellState,
} from "../../shared/desktop-contracts.js";
import { normalizeThreadTitle } from "../../shared/pi-message-mapper.js";
import {
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from "../pi-desktop-runtime.cjs";
import { getPiModule } from "../pi-module.cjs";
import { loadProjectGitState } from "../project-git.cjs";
import { listProjects, syncSessionSummaries } from "../thread-state-db.cjs";

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

export { loadProjectGitState };

export const subscribeDesktopEvents = subscribeRuntimeEvents;
