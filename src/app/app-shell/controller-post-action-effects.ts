import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";
import type { DesktopAction } from "../desktop/actions";
import type {
  ArchivedThread,
  ComposerState,
  DesktopActionResult,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
  ThreadData,
} from "../desktop/types";
import { isLocalSessionPath } from "../../../shared/session-paths";
import { desktopQueryKeys } from "../query/desktop-query";
import {
  applyProjectThreadToShellState,
  removeProjectThreadFromShellState,
} from "./project-thread-cache";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import { refreshArchivedThreadsIfOpen } from "./controller-action-helpers";
import {
  type ActionPayload,
  buildLocalThreadFallback,
  getPayloadProjectId,
  getPayloadProjectIds,
  getPayloadThreadIds,
  getResultThreadIds,
  hasActionError,
  hasDesktopBridge,
  isThreadList,
} from "./controller-action-utils";

export {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedShellState,
} from "./controller-optimistic-updates";

type RunPostDesktopActionEffectsInput = {
  action: DesktopAction;
  contextualPayload: ActionPayload;
  actionResult: DesktopActionResult | null;
  workspaceState: WorkspaceState;
  composerProjectId: string;
  dispatch: Dispatch<WorkspaceAction>;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  loadComposerState: (request?: {
    projectId?: string | null;
    composerMode?: "chat" | "code" | null;
  }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  refreshShellState: () => Promise<unknown>;
  setArchivedThreads: (threads: ArchivedThread[]) => void;
  setComposerState: (state: ComposerState | null) => void;
  setLiveThreadData: (updater: (state: ThreadData | null) => ThreadData | null) => void;
  setProjectGitState: (state: ProjectGitState | null) => void;
  queryClient: QueryClient;
};

export async function runPostDesktopActionEffects({
  action,
  contextualPayload,
  actionResult,
  workspaceState,
  composerProjectId,
  dispatch,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  loadProjectThreads,
  refreshShellState,
  setArchivedThreads,
  setComposerState,
  setLiveThreadData,
  setProjectGitState,
  queryClient,
}: RunPostDesktopActionEffectsInput) {
  const invalidateInboxThreads = () =>
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() });

  if (action === "thread.pin" || action === "thread.archive" || action === "thread.archive-many") {
    const projectId = getPayloadProjectId(contextualPayload);
    if (projectId) {
      await loadProjectThreads(projectId);
    }

    if (action === "thread.archive" || action === "thread.archive-many") {
      await refreshArchivedThreadsIfOpen({
        archivedThreadsVisible: workspaceState.activeView === "archived",
        loadArchivedThreads,
        setArchivedThreads,
      });
    }

    const archivedThreadIds =
      action === "thread.archive"
        ? [contextualPayload.threadId]
        : action === "thread.archive-many"
          ? getPayloadThreadIds(contextualPayload)
          : [];

    const selectedThreadId = workspaceState.selectedThreadId;
    if (selectedThreadId && new Set(archivedThreadIds).has(selectedThreadId)) {
      dispatch({ type: "clear-thread-selection" });
      dispatch({ type: "show-view", view: workspaceState.activeView === "chat" ? "chat" : "code" });
    }

    await invalidateInboxThreads();
  }

  if (
    action === "thread.restore" ||
    action === "thread.restore-many" ||
    action === "thread.delete" ||
    action === "thread.delete-many"
  ) {
    const isBatchThreadMutation =
      action === "thread.restore-many" || action === "thread.delete-many";

    const projectId = getPayloadProjectId(contextualPayload);
    if (isBatchThreadMutation) {
      await refreshShellState();
      const projectIds = [...new Set(getPayloadProjectIds(contextualPayload))];

      if (projectIds.length > 0) {
        await Promise.all(projectIds.map((batchProjectId) => loadProjectThreads(batchProjectId)));
      }
    } else if (projectId) {
      await loadProjectThreads(projectId);
    }

    setArchivedThreads(await loadArchivedThreads());

    const deletedBatchThreadIds = getResultThreadIds(actionResult?.result?.deletedThreadIds);

    const deletedThreadIds =
      action === "thread.delete"
        ? [contextualPayload.threadId]
        : action === "thread.delete-many"
          ? deletedBatchThreadIds.length > 0
            ? deletedBatchThreadIds
            : getPayloadThreadIds(contextualPayload)
          : [];

    const selectedThreadId = workspaceState.selectedThreadId;
    if (selectedThreadId && new Set(deletedThreadIds).has(selectedThreadId)) {
      dispatch({ type: "clear-thread-selection" });
      dispatch({ type: "show-view", view: workspaceState.activeView === "chat" ? "chat" : "code" });
    }

    await invalidateInboxThreads();
  }

  if (action === "thread.open" || action === "inbox.mark-read" || action === "inbox.dismiss") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId) {
      await loadProjectThreads(projectId);
    }

    await invalidateInboxThreads();
  }

  if (action === "project.edit-name") {
    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsVisible: workspaceState.activeView === "archived",
      loadArchivedThreads,
      setArchivedThreads,
    });
  }

  if (action === "project.refresh-repo-origin") {
    await refreshShellState();
  }

  if (action === "project.pin") {
    await refreshShellState();
  }

  if (action === "project.archive-threads") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId) {
      await loadProjectThreads(projectId);
    }

    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsVisible: workspaceState.activeView === "archived",
      loadArchivedThreads,
      setArchivedThreads,
    });

    if (contextualPayload.projectId === workspaceState.selectedProjectId) {
      dispatch({ type: "show-view", view: "code" });
    }

    await invalidateInboxThreads();
  }

  if (action === "project.remove-project") {
    if (hasActionError(actionResult)) {
      if (actionResult?.result?.didMutate !== true) {
        return;
      }

      const projectId = getPayloadProjectId(contextualPayload);
      await refreshShellState();
      const refreshedThreads = projectId ? await loadProjectThreads(projectId) : null;

      if (
        projectId === workspaceState.selectedProjectId &&
        workspaceState.selectedThreadId &&
        isThreadList(refreshedThreads) &&
        !refreshedThreads.some((thread) => thread.id === workspaceState.selectedThreadId)
      ) {
        dispatch({ type: "show-view", view: "code" });
      }

      await refreshArchivedThreadsIfOpen({
        archivedThreadsVisible: workspaceState.activeView === "archived",
        loadArchivedThreads,
        setArchivedThreads,
      });

      await invalidateInboxThreads();
      return;
    }

    if (contextualPayload.projectId === workspaceState.selectedProjectId) {
      dispatch({ type: "show-view", view: "code" });
    }

    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsVisible: workspaceState.activeView === "archived",
      loadArchivedThreads,
      setArchivedThreads,
    });

    await invalidateInboxThreads();
  }

  if (action === "composer.send" && hasActionError(actionResult)) {
    const projectId = getPayloadProjectId(contextualPayload);
    const sessionPath =
      typeof contextualPayload.sessionPath === "string" ? contextualPayload.sessionPath : null;

    if (projectId && sessionPath && isLocalSessionPath(sessionPath)) {
      removeProjectThreadFromShellState(queryClient, projectId, sessionPath);
    }
  }

  // Settings writes are local and already applied optimistically in the renderer.
  // Refreshing shell state here can race against that optimistic update and briefly
  // snap controls back to stale values before the next state load lands.

  if (action === "thread.new" || action === "project.add") {
    const projectId = getPayloadProjectId(contextualPayload) ?? composerProjectId;
    const resultProjectId =
      typeof actionResult?.result?.projectId === "string" ? actionResult.result.projectId : null;
    const sessionPath =
      typeof actionResult?.result?.sessionPath === "string"
        ? actionResult.result.sessionPath
        : null;
    const threadId =
      typeof actionResult?.result?.threadId === "string" ? actionResult.result.threadId : null;
    const localFallback =
      !threadId && !sessionPath && projectId && !hasDesktopBridge()
        ? buildLocalThreadFallback(projectId)
        : null;

    if (action === "project.add") {
      await refreshShellState();
    }

    if ((resultProjectId ?? projectId) && threadId && sessionPath) {
      const nextProjectId = resultProjectId ?? projectId;
      const optimisticThread = {
        id: threadId,
        title: "New thread",
        age: "Now",
        lastModifiedMs: Date.now(),
        sessionPath,
      };
      applyProjectThreadToShellState(queryClient, nextProjectId, optimisticThread, {
        revealProject: true,
      });
      dispatch({ type: "open-thread", projectId: nextProjectId, threadId, sessionPath });
      await loadProjectThreads(nextProjectId);
      applyProjectThreadToShellState(queryClient, nextProjectId, optimisticThread, {
        revealProject: true,
      });
    } else if (localFallback) {
      const optimisticThread = {
        id: localFallback.threadId,
        title: "New thread",
        age: "Now",
        lastModifiedMs: Date.now(),
        sessionPath: localFallback.sessionPath,
      };
      applyProjectThreadToShellState(queryClient, localFallback.projectId, optimisticThread, {
        revealProject: true,
      });
      dispatch({
        type: "open-thread",
        projectId: localFallback.projectId,
        threadId: localFallback.threadId,
        sessionPath: localFallback.sessionPath,
      });
    } else if (resultProjectId ?? projectId) {
      const nextProjectId = resultProjectId ?? projectId;
      dispatch({ type: "select-project", projectId: nextProjectId });
      await loadProjectThreads(nextProjectId);
    } else {
      dispatch({ type: "show-view", view: "code" });
    }

    if (!localFallback) {
      const nextComposerState = await loadComposerState({
        projectId: resultProjectId ?? projectId,
        composerMode: workspaceState.activeView === "chat" ? "chat" : "code",
      });
      if (nextComposerState) {
        setComposerState(nextComposerState);
      }
    }
  }

  if (action === "workspace.commit-options") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId) {
      setProjectGitState(await loadProjectGitState(projectId));
    }

    await refreshShellState();
  }

  if (action === "workspace.diff-preferences" && !hasActionError(actionResult)) {
    const sessionPath =
      typeof contextualPayload.sessionPath === "string" ? contextualPayload.sessionPath : null;
    if (sessionPath) {
      const hasBaseline = "diffBaseline" in contextualPayload;
      const hasRenderMode = "diffRenderMode" in contextualPayload;
      const nextBaseline = (contextualPayload.diffBaseline ?? null) as ProjectDiffBaseline | null;
      const nextRenderMode = (contextualPayload.diffRenderMode ??
        null) as ProjectDiffRenderMode | null;
      queryClient.setQueryData(desktopQueryKeys.thread(sessionPath), (current: unknown) => {
        const currentThread = current as ThreadData | null | undefined;
        if (!currentThread) {
          return currentThread;
        }

        return {
          ...currentThread,
          diffPreferences: {
            baseline: hasBaseline
              ? nextBaseline
              : (currentThread.diffPreferences?.baseline ?? null),
            renderMode: hasRenderMode
              ? nextRenderMode
              : (currentThread.diffPreferences?.renderMode ?? null),
          },
        };
      });
      setLiveThreadData((current) =>
        current?.sessionPath === sessionPath
          ? {
              ...current,
              diffPreferences: {
                baseline: hasBaseline ? nextBaseline : (current.diffPreferences?.baseline ?? null),
                renderMode: hasRenderMode
                  ? nextRenderMode
                  : (current.diffPreferences?.renderMode ?? null),
              },
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.threadPrefix(sessionPath),
      });
    }
  }

  if (action === "workspace.commit") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId && actionResult?.result?.committed === true) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectDiffPrefix(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
        }),
      ]);
      setProjectGitState(await loadProjectGitState(projectId));
    }
  }

  if (action === "projects.import.apply") {
    await refreshShellState();
  }
}
