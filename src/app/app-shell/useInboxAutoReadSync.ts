import type { QueryClient } from "@tanstack/react-query";
import { type Dispatch, useEffect } from "react";
import type { DesktopActionInvoker, InboxThread } from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";

type UseInboxAutoReadSyncInput = {
  dispatch: Dispatch<WorkspaceAction>;
  inboxQueryIsSuccess: boolean;
  inboxThreads: InboxThread[];
  invokeDesktopAction: DesktopActionInvoker;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  queryClient: QueryClient;
  workspaceState: WorkspaceState;
};

async function refreshInboxThreadState({
  loadProjectThreads,
  projectId,
  queryClient,
}: {
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  projectId: string;
  queryClient: QueryClient;
}) {
  await Promise.all([
    loadProjectThreads(projectId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  ]);
}

function markInboxThreadRead({
  invokeDesktopAction,
  loadProjectThreads,
  queryClient,
  thread,
  warningMessage,
}: {
  invokeDesktopAction: DesktopActionInvoker;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  queryClient: QueryClient;
  thread: InboxThread;
  warningMessage: string;
}) {
  void invokeDesktopAction("inbox.mark-read", {
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
  })
    .then(async () => {
      await refreshInboxThreadState({
        loadProjectThreads,
        projectId: thread.projectId,
        queryClient,
      });
    })
    .catch((error) => {
      console.warn(warningMessage, error);
    });
}

export function useInboxAutoReadSync({
  dispatch,
  inboxQueryIsSuccess,
  inboxThreads,
  invokeDesktopAction,
  loadProjectThreads,
  queryClient,
  workspaceState,
}: UseInboxAutoReadSyncInput) {
  useEffect(() => {
    if (!inboxQueryIsSuccess) {
      return;
    }

    if (inboxThreads.length === 0) {
      if (workspaceState.selectedInboxSessionPath !== null) {
        dispatch({ type: "select-inbox-thread", sessionPath: null });
      }
      return;
    }

    const selectedInboxThread =
      inboxThreads.find(
        (thread) => thread.sessionPath === workspaceState.selectedInboxSessionPath,
      ) ?? null;

    if (!selectedInboxThread) {
      const nextThread = inboxThreads[0] ?? null;

      dispatch({
        type: "select-inbox-thread",
        sessionPath: nextThread?.sessionPath ?? null,
      });

      if (workspaceState.activeView === "inbox" && nextThread?.unread) {
        markInboxThreadRead({
          invokeDesktopAction,
          loadProjectThreads,
          queryClient,
          thread: nextThread,
          warningMessage: "Failed to auto-mark selected inbox thread read.",
        });
      }

      return;
    }

    if (workspaceState.activeView === "inbox" && selectedInboxThread.unread) {
      markInboxThreadRead({
        invokeDesktopAction,
        loadProjectThreads,
        queryClient,
        thread: selectedInboxThread,
        warningMessage: "Failed to mark visible inbox thread read.",
      });
    }
  }, [
    dispatch,
    inboxQueryIsSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    workspaceState.activeView,
    workspaceState.selectedInboxSessionPath,
  ]);
}
