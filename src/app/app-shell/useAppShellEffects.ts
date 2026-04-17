import { useEffect, useLayoutEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getPersistedSessionPath } from "../../../shared/session-paths";
import type {
  AppSettings,
  ArchivedThread,
  ComposerState,
  DesktopEvent,
  ProjectGitState,
} from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import { isUtilityView } from "../state/workspace";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { Project } from "../types";

type QueryClientLike = {
  setQueriesData: (filters: { queryKey: readonly unknown[] }, updater: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
};

type DesktopEventSelectionState = Pick<
  WorkspaceState,
  "activeView" | "selectedSessionPath" | "selectedInboxSessionPath"
>;

export function getVisibleDesktopSessionPath(workspaceState: DesktopEventSelectionState) {
  return workspaceState.activeView === "thread" || workspaceState.activeView === "gitops"
    ? getPersistedSessionPath(workspaceState.selectedSessionPath)
    : workspaceState.activeView === "inbox"
      ? (workspaceState.selectedInboxSessionPath ?? null)
      : null;
}

export function shouldAutoOpenStartedThread(
  reason: Extract<DesktopEvent, { type: "thread-update" }>["reason"],
  workspaceState: DesktopEventSelectionState,
) {
  const visibleSessionPath = getVisibleDesktopSessionPath(workspaceState);

  return (
    reason === "start" &&
    (workspaceState.activeView === "code" ||
      (workspaceState.activeView === "thread" && visibleSessionPath === null))
  );
}

export function shouldCloseUtilityViewOnEscape(
  activeView: WorkspaceState["activeView"],
  event: Pick<KeyboardEvent, "key" | "defaultPrevented">,
) {
  return isUtilityView(activeView) && event.key === "Escape" && !event.defaultPrevented;
}

export function useAppShellEffects({
  projects,
  collapsedProjectIds,
  workspaceState,
  composerProjectId,
  shellComposerState,
  shellAppSettings,
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
  shellAppSettings: AppSettings | null | undefined;
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
    if (workspaceState.activeView !== "archived") {
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
  }, [loadArchivedThreads, setArchivedThreads, workspaceState.activeView]);

  useEffect(() => {
    if (!shellComposerState) {
      return;
    }

    setComposerState((current) => current ?? shellComposerState);
  }, [setComposerState, shellComposerState]);

  const lastAppliedThreadPreferenceKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const visibleThreadKey =
      workspaceState.activeView === "thread" && workspaceState.selectedSessionPath
        ? workspaceState.selectedSessionPath
        : null;

    if (!visibleThreadKey) {
      lastAppliedThreadPreferenceKeyRef.current = null;
      return;
    }

    const globalTakeoverVisible = shellAppSettings?.piTuiTakeover ?? false;
    const sessionOverrideVisible = workspaceState.takeoverOverrides[visibleThreadKey];
    const effectiveTakeoverVisible = sessionOverrideVisible ?? globalTakeoverVisible;
    const visibleThreadPreferenceKey = `${visibleThreadKey}:${effectiveTakeoverVisible}`;

    if (lastAppliedThreadPreferenceKeyRef.current === visibleThreadPreferenceKey) {
      return;
    }

    lastAppliedThreadPreferenceKeyRef.current = visibleThreadPreferenceKey;
    dispatch({
      type: "set-takeover-visible",
      visible: effectiveTakeoverVisible,
    });
  }, [
    dispatch,
    shellAppSettings?.piTuiTakeover,
    workspaceState.activeView,
    workspaceState.takeoverOverrides,
    workspaceState.selectedSessionPath,
  ]);

  useEffect(() => {
    if (!composerProjectId) {
      return;
    }

    let cancelled = false;

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: composerProjectId,
        sessionPath:
          workspaceState.activeView === "thread" || workspaceState.activeView === "gitops"
            ? workspaceState.selectedSessionPath
            : null,
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
    if (workspaceState.activeView !== "gitops" || !composerProjectId) {
      return;
    }

    let cancelled = false;

    void loadProjectGitState(composerProjectId)
      .then((nextProjectGitState) => {
        if (!cancelled) {
          setProjectGitState(nextProjectGitState);
        }
      })
      .catch((error) => {
        console.warn("Failed to refresh project git state for the diff panel.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [composerProjectId, loadProjectGitState, setProjectGitState, workspaceState.activeView]);

  useEffect(() => {
    if (!window.piDesktop?.watchSession) {
      return;
    }

    const watchedSessionPath =
      workspaceState.activeView === "thread" || workspaceState.activeView === "gitops"
        ? getPersistedSessionPath(workspaceState.selectedSessionPath)
        : null;

    void window.piDesktop.watchSession(watchedSessionPath).catch((error) => {
      console.warn("Failed to update watched Pi session.", error);
    });
  }, [workspaceState.activeView, workspaceState.selectedSessionPath]);

  useEffect(() => {
    if (!isUtilityView(workspaceState.activeView)) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldCloseUtilityViewOnEscape(workspaceState.activeView, event)) {
        return;
      }

      dispatch({ type: "close-utility-view" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, workspaceState.activeView]);

  const desktopEventStateRef = useRef({
    composerProjectId,
    workspaceState: {
      activeView: workspaceState.activeView,
      selectedSessionPath: workspaceState.selectedSessionPath,
      selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
    } satisfies DesktopEventSelectionState,
  });

  useEffect(() => {
    desktopEventStateRef.current = {
      composerProjectId,
      workspaceState: {
        activeView: workspaceState.activeView,
        selectedSessionPath: workspaceState.selectedSessionPath,
        selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
      },
    };
  }, [
    composerProjectId,
    workspaceState.activeView,
    workspaceState.selectedInboxSessionPath,
    workspaceState.selectedSessionPath,
  ]);

  useEffect(() => {
    if (!window.piDesktop?.subscribe) {
      return;
    }

    // Keep the desktop event subscription stable. Re-subscribing on every selection change can
    // drop in-flight thread updates exactly when a GUI-started thread flips from a local draft
    // path to a persisted session path, which makes the live stream appear stuck.
    const unsubscribe = window.piDesktop.subscribe((event: DesktopEvent) => {
      const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
        desktopEventStateRef.current;
      const visibleSessionPath = getVisibleDesktopSessionPath(latestWorkspaceState);

      if (event.type === "composer-update") {
        const shouldApplyComposerUpdate = event.sessionPath
          ? event.sessionPath === visibleSessionPath
          : event.projectId === latestComposerProjectId &&
            ((latestWorkspaceState.activeView !== "thread" &&
              latestWorkspaceState.activeView !== "gitops") ||
              visibleSessionPath === null);

        if (shouldApplyComposerUpdate) {
          setComposerState(event.composer);
        }

        return;
      }

      queryClient.setQueriesData(
        { queryKey: desktopQueryKeys.thread(event.sessionPath) },
        event.thread,
      );

      if (event.composer && event.sessionPath === visibleSessionPath) {
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

      if (shouldAutoOpenStartedThread(event.reason, latestWorkspaceState)) {
        dispatch({
          type: "open-thread",
          projectId: event.projectId,
          threadId: event.threadId,
          sessionPath: event.sessionPath,
        });
      }

      if (event.reason === "end" || event.reason === "external") {
        if (latestWorkspaceState.activeView === "gitops") {
          void queryClient.invalidateQueries({
            queryKey: desktopQueryKeys.projectDiffPrefix(event.projectId),
          });
        }

        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectDiffStatsPrefix(event.projectId),
        });

        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectCommitsPrefix(event.projectId),
        });

        if (event.projectId === latestComposerProjectId) {
          void loadProjectGitState(event.projectId).then((nextProjectGitState) => {
            setProjectGitState(nextProjectGitState);
          });
        }
      }
    });

    return unsubscribe;
  }, [
    dispatch,
    loadProjectGitState,
    loadProjectThreads,
    queryClient,
    scheduleShellStateRefresh,
    setComposerState,
    setProjectGitState,
  ]);
}
