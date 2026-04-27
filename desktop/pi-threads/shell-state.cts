import type { ShellState } from "../../shared/desktop-contracts.ts";
import { loadAppSettings } from "../app-settings.cts";
import { loadPiSettings } from "../pi-settings.cts";
import { getComposerState } from "../pi-desktop-runtime.cts";
import { getPiModule } from "../pi-module.cts";
import { ensureProject, listProjects } from "../thread-state-db.cts";
import {
  enrichProjectsWithResolvedIds,
  resolveProjectPathForComparison,
} from "./project-paths.cts";
import { scheduleShellIndexSync } from "./shell-index.cts";

type SessionStorage = {
  agentDir: string;
  sessionDir: string | null;
};

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

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { SessionManager } = await getPiModule();
  const { agentDir, sessionDir } = await getSessionStorage(cwd);

  ensureProject(cwd);
  scheduleShellIndexSync(cwd);
  const composer = await getComposerState({ projectId: cwd });
  const appSettings = loadAppSettings();
  const piSettings = await loadPiSettings(cwd);
  const [resolvedCwd, projects] = await Promise.all([
    resolveProjectPathForComparison(cwd),
    enrichProjectsWithResolvedIds(listProjects(cwd)),
  ]);

  return {
    platform: process.platform,
    mockMode: false,
    productName: "howcode",
    cwd,
    resolvedCwd,
    agentDir,
    sessionDir: sessionDir ?? SessionManager.create(cwd).getSessionDir(),
    appSettings,
    piSettings,
    availableHosts: ["Local"],
    composer,
    projects,
  };
}
