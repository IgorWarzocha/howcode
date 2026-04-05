import type { Project } from "../../../types";

export type SidebarProjectsFilterMode = "all" | "favourites" | "github";

function projectMatchesFilter(project: Project, filterMode: SidebarProjectsFilterMode) {
  if (filterMode === "github") {
    return Boolean(project.repoOriginUrl);
  }

  if (filterMode === "favourites") {
    return Boolean(project.pinned) || project.threads.some((thread) => Boolean(thread.pinned));
  }

  return true;
}

function getVisibleProjectThreads(project: Project, filterMode: SidebarProjectsFilterMode) {
  if (filterMode !== "favourites" || project.pinned) {
    return project.threads;
  }

  return project.threads.filter((thread) => Boolean(thread.pinned));
}

export function getSidebarVisibleProjects(input: {
  projects: Project[];
  searchQuery: string;
  filterMode: SidebarProjectsFilterMode;
}) {
  const normalizedQuery = input.searchQuery.trim().toLowerCase();
  const autoExpandedProjectIds = new Set<string>();

  const projects = input.projects.flatMap((project) => {
    if (!projectMatchesFilter(project, input.filterMode)) {
      return [];
    }

    const visibleThreads = getVisibleProjectThreads(project, input.filterMode);

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
