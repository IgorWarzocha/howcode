import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ArchivedThread,
  ComposerState,
  DesktopEvent,
  ProjectGitState,
} from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { Project } from "../types";

type QueryClientLike = {
  setQueriesData: (filters: { queryKey: readonly unknown[] }, updater: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
};

export function useAppShellEffects({
  projects,
  collapsedProjectIds,
  workspaceState,
  composerProjectId,
  shellComposerState,
  loadProjectThreads,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  scheduleShellStateRefresh,
  queryClient,
  dispatch,
  setArchivedThreads,
  setComposerState,
  setProjectGitState,
}: {
  projects: Project[];
  collapsedProjectIds: Record<string, boolean>;
  workspaceState: WorkspaceState;
  composerProjectId: string;
  shellComposerState: ComposerState | null | undefined;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  loadComposerState: (request?: {
    projectId?: string | null;
    sessionPath?: string | null;
  }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  scheduleShellStateRefresh: () => void;
  queryClient: QueryClientLike;
  dispatch: Dispatch<WorkspaceAction>;
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
}) {
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
    if (!workspaceState.archivedThreadsOpen) {
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
  }, [loadArchivedThreads, setArchivedThreads, workspaceState.archivedThreadsOpen]);

  useEffect(() => {
    if (!shellComposerState) {
      return;
    }

    setComposerState((current) => current ?? shellComposerState);
  }, [setComposerState, shellComposerState]);

  useEffect(() => {
    if (!composerProjectId) {
      return;
    }

    let cancelled = false;

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: composerProjectId,
        sessionPath:
          workspaceState.activeView === "thread" ? workspaceState.selectedSessionPath : null,
      });

      if (!cancelled && nextComposerState) {
        setComposerState(nextComposerState);
      }
    };

    void syncComposerState();

    return () => {
      cancelled = true;
    };
  }, [
    composerProjectId,
    loadComposerState,
    setComposerState,
    workspaceState.activeView,
    workspaceState.selectedSessionPath,
  ]);

  useEffect(() => {
    if (!composerProjectId) {
      setProjectGitState(null);
      return;
    }

    setProjectGitState(null);

    let cancelled = false;

    const syncProjectGitState = async () => {
      const nextProjectGitState = await loadProjectGitState(composerProjectId);
      if (!cancelled) {
        setProjectGitState(nextProjectGitState);
      }
    };

    void syncProjectGitState();

    return () => {
      cancelled = true;
    };
  }, [composerProjectId, loadProjectGitState, setProjectGitState]);

  useEffect(() => {
    if (!window.piDesktop?.watchSession) {
      return;
    }

    const watchedSessionPath =
      workspaceState.activeView === "thread" ? (workspaceState.selectedSessionPath ?? null) : null;

    void window.piDesktop.watchSession(watchedSessionPath).catch((error) => {
      console.warn("Failed to update watched Pi session.", error);
    });
  }, [workspaceState.activeView, workspaceState.selectedSessionPath]);

  useEffect(() => {
    if (!window.piDesktop?.subscribe) {
      return;
    }

    const visibleSessionPath =
      workspaceState.activeView === "thread"
        ? (workspaceState.selectedSessionPath ?? null)
        : workspaceState.activeView === "inbox"
          ? (workspaceState.selectedInboxSessionPath ?? null)
          : null;

    const unsubscribe = window.piDesktop.subscribe((event: DesktopEvent) => {
      if (event.type === "composer-update") {
        setComposerState(event.composer);
        return;
      }

      queryClient.setQueriesData(
        { queryKey: desktopQueryKeys.thread(event.sessionPath) },
        event.thread,
      );

      if (event.composer) {
        setComposerState(event.composer);
      }

      if (event.reason === "start" || event.reason === "end" || event.reason === "external") {
        void loadProjectThreads(event.projectId);
        void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() });
        scheduleShellStateRefresh();
      }

      if (
        (event.reason === "end" || event.reason === "external") &&
        visibleSessionPath === event.sessionPath
      ) {
        void window.piDesktop
          ?.invokeAction("inbox.mark-read", {
            sessionPath: event.sessionPath,
            projectId: event.projectId,
          })
          .then(async () => {
            await Promise.all([
              loadProjectThreads(event.projectId),
              queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
            ]);
          })
          .catch((error) => {
            console.warn("Failed to keep active inbox thread marked read.", error);
          });
      }

      if (event.reason === "start" && workspaceState.activeView !== "inbox") {
        dispatch({
          type: "open-thread",
          projectId: event.projectId,
          threadId: event.threadId,
          sessionPath: event.sessionPath,
        });
      }

      if (event.reason === "end" || event.reason === "external") {
        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectDiff(event.projectId),
        });

        if (event.projectId === composerProjectId) {
          void loadProjectGitState(event.projectId).then((nextProjectGitState) => {
            setProjectGitState(nextProjectGitState);
          });
        }
      }
    });

    return unsubscribe;
  }, [
    composerProjectId,
    dispatch,
    loadProjectGitState,
    loadProjectThreads,
    queryClient,
    scheduleShellStateRefresh,
    setComposerState,
    setProjectGitState,
    workspaceState.activeView,
    workspaceState.selectedInboxSessionPath,
    workspaceState.selectedSessionPath,
  ]);
}
