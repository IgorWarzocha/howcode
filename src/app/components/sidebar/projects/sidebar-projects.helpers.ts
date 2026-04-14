import type { Project } from "../../../types";

export type SidebarProjectsFilterMode = "all" | "favourites" | "github" | "terminal" | "recent";

function projectMatchesFilter(
  project: Project,
  filterMode: SidebarProjectsFilterMode,
  terminalRunningSessionPaths: ReadonlySet<string>,
  appLaunchedAtMs: number,
) {
  if (filterMode === "github") {
    return Boolean(project.repoOriginUrl);
  }

  if (filterMode === "favourites") {
    return Boolean(project.pinned) || project.threads.some((thread) => Boolean(thread.pinned));
  }

  if (filterMode === "terminal") {
    return project.threads.some(
      (thread) =>
        typeof thread.sessionPath === "string" &&
        terminalRunningSessionPaths.has(thread.sessionPath),
    );
  }

  if (filterMode === "recent") {
    return project.threads.some((thread) => (thread.lastModifiedMs ?? 0) >= appLaunchedAtMs);
  }

  return true;
}

function getVisibleProjectThreads(
  project: Project,
  filterMode: SidebarProjectsFilterMode,
  terminalRunningSessionPaths: ReadonlySet<string>,
  appLaunchedAtMs: number,
) {
  if (filterMode === "terminal") {
    return project.threads.filter(
      (thread) =>
        typeof thread.sessionPath === "string" &&
        terminalRunningSessionPaths.has(thread.sessionPath),
    );
  }

  if (filterMode === "recent") {
    return project.threads.filter((thread) => (thread.lastModifiedMs ?? 0) >= appLaunchedAtMs);
  }

  if (filterMode !== "favourites" || project.pinned) {
    return project.threads;
  }

  return project.threads.filter((thread) => Boolean(thread.pinned));
}

export function getSidebarVisibleProjects(input: {
  projects: Project[];
  searchQuery: string;
  filterMode: SidebarProjectsFilterMode;
  terminalRunningSessionPaths: ReadonlySet<string>;
  appLaunchedAtMs: number;
}) {
  const normalizedQuery = input.searchQuery.trim().toLowerCase();
  const autoExpandedProjectIds = new Set<string>();

  const projects = input.projects.flatMap((project) => {
    if (
      !projectMatchesFilter(
        project,
        input.filterMode,
        input.terminalRunningSessionPaths,
        input.appLaunchedAtMs,
      )
    ) {
      return [];
    }

    const visibleThreads = getVisibleProjectThreads(
      project,
      input.filterMode,
      input.terminalRunningSessionPaths,
      input.appLaunchedAtMs,
    );

    if (!normalizedQuery) {
      return [
        {
          ...project,
          threads: visibleThreads,
          threadCount: visibleThreads.length,
        },
      ];
    }

    const projectMatchesQuery = project.name.toLowerCase().includes(normalizedQuery);
    const matchingThreads = visibleThreads.filter((thread) =>
      thread.title.toLowerCase().includes(normalizedQuery),
    );

    if (!projectMatchesQuery && matchingThreads.length === 0) {
      return [];
    }

    autoExpandedProjectIds.add(project.id);

    return [
      {
        ...project,
        threads: projectMatchesQuery ? visibleThreads : matchingThreads,
        threadCount: projectMatchesQuery ? visibleThreads.length : matchingThreads.length,
        threadsLoaded: project.threadsLoaded || matchingThreads.length > 0,
      },
    ];
  });

  return {
    projects,
    autoExpandedProjectIds,
  };
}
