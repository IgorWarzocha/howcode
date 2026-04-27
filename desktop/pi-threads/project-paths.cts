import { realpath } from "node:fs/promises";
import path from "node:path";
import type { Project } from "../../shared/desktop-contracts.ts";

export async function resolveProjectPathForComparison(projectId: string) {
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

export async function enrichProjectsWithResolvedIds(projects: Project[]) {
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      resolvedId: await resolveProjectPathForComparison(project.id),
    })),
  );
}
