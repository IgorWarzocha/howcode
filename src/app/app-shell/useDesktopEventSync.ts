import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ComposerState, DesktopEvent, ProjectGitState, ThreadData } from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import {
  type DesktopEventSelectionState,
  getVisibleDesktopSessionPath,
  invalidateProjectWorktreeQueries,
  refreshVisibleInboxThread,
  shouldAutoOpenStartedThread,
} from "./desktop-event-sync";

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
};

type UseDesktopEventSyncInput = {
  composerProjectId: string;
  workspaceState: WorkspaceState;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  scheduleShellStateRefresh: () => void;
  queryClient: QueryClientLike;
  dispatch: Dispatch<WorkspaceAction>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>;
};

export function useDesktopEventSync({
  composerProjectId,
  workspaceState,
  loadProjectThreads,
  loadProjectGitState,
  scheduleShellStateRefresh,
  queryClient,
  dispatch,
  setComposerState,
  setLiveThreadData,
  setProjectGitState,
  setThreadHistoryCompactions,
}: UseDesktopEventSyncInput) {
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

    // Keep the subscription stable. Re-subscribing on every selection change can drop in-flight
    // thread updates when a GUI-started thread flips from local draft to persisted session path.
    const unsubscribe = window.piDesktop.subscribe((event: DesktopEvent) => {
      const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
        desktopEventStateRef.current;
      const visibleSessionPath = getVisibleDesktopSessionPath(latestWorkspaceState);

      if (event.type === "shell-state-refresh") {
        scheduleShellStateRefresh();
        return;
      }

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

      if (event.type !== "thread-update") {
        return;
      }

      queryClient.setQueryData(desktopQueryKeys.thread(event.sessionPath), event.thread);

      const isVisibleThreadUpdate = event.sessionPath === visibleSessionPath;
      const isCompactionThreadUpdate =
        event.reason === "compaction-start" || event.reason === "compaction";

      setLiveThreadData((current) =>
        isVisibleThreadUpdate || current?.sessionPath === event.sessionPath
          ? event.thread
          : current,
      );

      if (isCompactionThreadUpdate && isVisibleThreadUpdate) {
        setThreadHistoryCompactions(0);
      }

      if (event.composer && event.sessionPath === visibleSessionPath) {
        setComposerState(event.composer);
      }

      if (
        event.reason === "start" ||
        event.reason === "end" ||
        event.reason === "external" ||
        event.reason === "compaction"
      ) {
        void loadProjectThreads(event.projectId);
        void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() });
        if (event.reason !== "compaction") {
          scheduleShellStateRefresh();
        }
      }

      if (
        (event.reason === "end" || event.reason === "external") &&
        visibleSessionPath === event.sessionPath
      ) {
        void refreshVisibleInboxThread({ event, loadProjectThreads, queryClient }).catch(
          (error) => {
            console.warn("Failed to keep active inbox thread marked read.", error);
          },
        );
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
        invalidateProjectWorktreeQueries({
          activeView: latestWorkspaceState.activeView,
          projectId: event.projectId,
          queryClient,
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
    setLiveThreadData,
    setProjectGitState,
    setThreadHistoryCompactions,
  ]);
}
