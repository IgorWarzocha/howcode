import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ProjectImportCandidate } from "../shared/desktop-contracts.ts";
import { setProjectImportState } from "./app-settings.cts";
import { getOriginUrl } from "./project-git/project-state.cts";
import { ensureProject, listProjects, setProjectRepoOrigin } from "./thread-state-db.cts";

const MAX_SCAN_DEPTH = 4;
const skippedDirectoryNames = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  ".idea",
  ".vscode",
]);

async function hasGitDirectory(projectId: string) {
  try {
    const entries = await readdir(projectId, { withFileTypes: true, encoding: "utf8" });
    return entries.some((entry) => entry.isDirectory() && entry.name === ".git");
  } catch {
    return false;
  }
}

async function walkRoots(
  projectId: string,
  depth: number,
  results: Set<string>,
  visited: Set<string>,
) {
  const normalizedProjectId = path.resolve(projectId);
  if (visited.has(normalizedProjectId)) {
    return;
  }

  visited.add(normalizedProjectId);

  if (await hasGitDirectory(normalizedProjectId)) {
    results.add(normalizedProjectId);
    return;
  }

  if (depth <= 0) {
    return;
  }

  let entries: Dirent<string>[];
  try {
    entries = await readdir(normalizedProjectId, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || skippedDirectoryNames.has(entry.name)) {
      continue;
    }

    await walkRoots(path.join(normalizedProjectId, entry.name), depth - 1, results, visited);
  }
}

export async function scanProjectImportRoots(roots: string[]): Promise<ProjectImportCandidate[]> {
  const discoveredProjectIds = new Set<string>();
  const visited = new Set<string>();
  const existingProjectIds = new Set(listProjects(process.cwd()).map((project) => project.id));

  for (const root of roots) {
    await walkRoots(root, MAX_SCAN_DEPTH, discoveredProjectIds, visited);
  }

  const candidates = await Promise.all(
    [...discoveredProjectIds]
      .sort((left, right) => left.localeCompare(right))
      .map(async (projectId) => {
        const originUrl = await getOriginUrl(projectId);
        return {
          projectId,
          name: path.basename(projectId) || projectId,
          isGitRepo: true,
          hasOrigin: originUrl !== null,
          originUrl,
          alreadyImported: existingProjectIds.has(projectId),
        } satisfies ProjectImportCandidate;
      }),
  );

  return candidates;
}

export async function importProjects(
  projects: Array<{ projectId: string; originUrl?: string | null }>,
) {
  for (const project of projects) {
    ensureProject(project.projectId);
    setProjectRepoOrigin(project.projectId, project.originUrl ?? null);
  }

  if (projects.length > 0) {
    setProjectImportState(true);
  }

  return {
    importedProjectIds: projects.map((project) => project.projectId),
  };
}
