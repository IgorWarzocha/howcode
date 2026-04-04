import type {
  ComposerState,
  ComposerStateRequest,
  ShellState,
} from "../../shared/desktop-contracts";
import { normalizeThreadTitle } from "../../shared/pi-message-mapper";
import { loadAppSettings } from "../app-settings";
import {
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from "../pi-desktop-runtime";
import { getPiModule } from "../pi-module";
import { loadProjectGitState } from "../project-git";
import { listProjects, syncSessionSummaries } from "../thread-state-db";
import { setWatchedSessionPath } from "./session-watch";

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
  const appSettings = loadAppSettings();

  return {
    platform: process.platform,
    mockMode: false,
    productName: "Pi Desktop Mock",
    cwd,
    agentDir,
    sessionDir: sessionDir ?? SessionManager.create(cwd).getSessionDir(),
    appSettings,
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
export { setWatchedSessionPath };

export const subscribeDesktopEvents = subscribeRuntimeEvents;
