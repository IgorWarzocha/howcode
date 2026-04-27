import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings,
  ArchivedThread,
  ComposerState,
  InboxThread,
  ProjectGitState,
  ThreadData,
} from "../desktop/types";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { Project } from "../types";
import { getVisibleDesktopSessionPath, shouldAutoOpenStartedThread } from "./desktop-event-sync";
import { useComposerGitStateSync } from "./useComposerGitStateSync";
import { useDesktopEventSync } from "./useDesktopEventSync";
import { useProjectShellSync } from "./useProjectShellSync";
import { useTakeoverVisibilitySync } from "./useTakeoverVisibilitySync";
import {
  shouldCloseUtilityViewOnEscape,
  useUtilityViewEscape,
  useWatchedSessionSync,
} from "./useWindowShellSync";

export {
  getVisibleDesktopSessionPath,
  shouldAutoOpenStartedThread,
  shouldCloseUtilityViewOnEscape,
};

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void;
  setQueriesData: (filters: { queryKey: readonly unknown[] }, updater: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
};

export function useAppShellEffects({
  projects,
  collapsedProjectIds,
  workspaceState,
  selectedInboxThread,
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
  setLiveThreadData,
  setProjectGitState,
  setThreadHistoryCompactions,
}: {
  projects: Project[];
  collapsedProjectIds: Record<string, boolean>;
  workspaceState: WorkspaceState;
  selectedInboxThread: InboxThread | null;
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
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>;
}) {
  useProjectShellSync({
    projects,
    collapsedProjectIds,
    activeView: workspaceState.activeView,
    loadProjectThreads,
    loadArchivedThreads,
    dispatch,
    setArchivedThreads,
  });

  useTakeoverVisibilitySync({ shellAppSettings, workspaceState, dispatch });

  useComposerGitStateSync({
    workspaceState,
    selectedInboxThread,
    composerProjectId,
    shellComposerState,
    loadComposerState,
    loadProjectGitState,
    setComposerState,
    setProjectGitState,
  });

  useWatchedSessionSync(workspaceState);
  useUtilityViewEscape({ activeView: workspaceState.activeView, dispatch });

  useDesktopEventSync({
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
  });
}
