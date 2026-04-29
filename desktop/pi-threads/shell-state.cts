import type { ShellState } from "../../shared/desktop-contracts.ts";
import path from "node:path";
import { loadAppSettings } from "../app-settings/readers.cts";
import { loadPiSettings } from "../pi-settings.cts";
import { getComposerState } from "../pi-desktop-runtime.cts";
import { invokeRuntimeHost } from "../runtime-host/client-bridge.cts";
import { ensureProject, listProjects } from "../thread-state-db.cts";
import {
  enrichProjectsWithResolvedIds,
  resolveProjectPathForComparison,
} from "./project-paths.cts";
import { scheduleShellIndexSync } from "./shell-index.cts";

type SessionStorage = { agentDir: string; sessionDir: string };

function getProjectNameQualifier(projectId: string) {
  const parentName = path.basename(path.dirname(projectId));
  return parentName || path.dirname(projectId) || projectId;
}

function disambiguateDuplicateProjectNames<PROJECT extends { id: string; name: string }>(
  projects: PROJECT[],
) {
  const projectsByName = new Map<string, PROJECT[]>();

  for (const project of projects) {
    const normalizedName = project.name.trim().toLowerCase();
    projectsByName.set(normalizedName, [...(projectsByName.get(normalizedName) ?? []), project]);
  }

  return projects.map((project) => {
    const duplicateProjects = projectsByName.get(project.name.trim().toLowerCase());
    if (!duplicateProjects || duplicateProjects.length <= 1) {
      return project;
    }

    return {
      ...project,
      name: `${project.name} · ${getProjectNameQualifier(project.id)}`,
    };
  });
}

function getSessionStorage(cwd: string): Promise<SessionStorage> {
  return invokeRuntimeHost("getPiSessionStorage", { projectPath: cwd });
}

export async function loadShellState(cwd: string): Promise<ShellState> {
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
  const visibleProjects = disambiguateDuplicateProjectNames(projects);

  return {
    platform: process.platform,
    mockMode: false,
    productName: "howcode",
    cwd,
    resolvedCwd,
    agentDir,
    sessionDir,
    appSettings,
    piSettings,
    composer,
    projects: visibleProjects,
  };
}
