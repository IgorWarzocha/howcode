import { useEffect } from "react";
import type { Dispatch } from "react";
import type { ArchivedThread } from "../desktop/types";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { Project } from "../types";

type UseProjectShellSyncInput = {
  projects: Project[];
  collapsedProjectIds: Record<string, boolean>;
  activeView: WorkspaceState["activeView"];
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  dispatch: Dispatch<WorkspaceAction>;
  setArchivedThreads: (threads: ArchivedThread[]) => void;
};

export function useProjectShellSync({
  projects,
  collapsedProjectIds,
  activeView,
  loadProjectThreads,
  loadArchivedThreads,
  dispatch,
  setArchivedThreads,
}: UseProjectShellSyncInput) {
  useEffect(() => {
    if (!projects.length) {
      return;
    }

    dispatch({ type: "sync-projects", projects });
  }, [dispatch, projects]);

  useEffect(() => {
    const expandedProjects = projects.filter(
      (project) => !collapsedProjectIds[project.id] && !project.threadsLoaded,
    );

    for (const project of expandedProjects) {
      void loadProjectThreads(project.id);
    }
  }, [collapsedProjectIds, loadProjectThreads, projects]);

  useEffect(() => {
    if (activeView !== "archived") {
      return;
    }

    let cancelled = false;

    const syncArchivedThreads = async () => {
      const nextArchivedThreads = await loadArchivedThreads();
      if (!cancelled) {
        setArchivedThreads(nextArchivedThreads);
      }
    };

    void syncArchivedThreads();

    return () => {
      cancelled = true;
    };
  }, [activeView, loadArchivedThreads, setArchivedThreads]);
}
