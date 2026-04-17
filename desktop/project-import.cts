import type { ProjectImportCandidate } from "../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../shared/desktop-working-directory.ts";
import { setProjectImportState } from "./app-settings.cts";
import { getOriginUrl, isGitRepository } from "./project-git/project-state.cts";
import { listProjects, setProjectRepoOrigin } from "./thread-state-db.cts";

function resolveProjectIds(projectIds: string[]) {
  if (projectIds.length > 0) {
    return [...new Set(projectIds)];
  }

  return listProjects(getDesktopWorkingDirectory())
    .filter((project) => project.threadCount !== 0)
    .map((project) => project.id);
}

export async function scanKnownProjects(projectIds: string[]): Promise<ProjectImportCandidate[]> {
  const knownProjects = new Map(
    listProjects(getDesktopWorkingDirectory()).map((project) => [project.id, project] as const),
  );

  return await Promise.all(
    resolveProjectIds(projectIds).map(async (projectId) => {
      const knownProject = knownProjects.get(projectId);
      const [isGitRepo, originUrl] = await Promise.all([
        isGitRepository(projectId),
        getOriginUrl(projectId),
      ]);

      return {
        projectId,
        name: knownProject?.name ?? projectId,
        isGitRepo,
        hasOrigin: originUrl !== null,
        originUrl,
        alreadyImported: knownProject?.repoOriginChecked ?? false,
      } satisfies ProjectImportCandidate;
    }),
  );
}

export async function importProjects(projectIds: string[]) {
  const candidates = await scanKnownProjects(projectIds);

  for (const candidate of candidates) {
    setProjectRepoOrigin(candidate.projectId, candidate.originUrl);
  }

  setProjectImportState(true);

  return {
    importedProjectIds: candidates.map((candidate) => candidate.projectId),
    checkedProjectCount: candidates.length,
    repoProjectCount: candidates.filter((candidate) => candidate.isGitRepo).length,
    originProjectCount: candidates.filter((candidate) => candidate.hasOrigin).length,
  };
}
