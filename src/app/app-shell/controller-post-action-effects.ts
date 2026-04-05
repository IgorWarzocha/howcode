import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";
import type { DesktopAction } from "../desktop/actions";
import type {
  ArchivedThread,
  ComposerState,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
} from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import { refreshArchivedThreadsIfOpen } from "./controller-action-helpers";

type ActionPayload = Record<string, unknown>;

function getPayloadProjectId(payload: ActionPayload) {
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

function hasElectrobunDesktopBridge() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    typeof (window as Window & { __electrobunRpcSocketPort?: unknown })
      .__electrobunRpcSocketPort === "number"
  );
}

function buildLocalThreadFallback(projectId: string) {
  const timestamp = Date.now();
  return {
    projectId,
    threadId: `local-thread-${timestamp}`,
    sessionPath: `local://${encodeURIComponent(projectId)}/${timestamp}`,
  };
}

export function getOptimisticallyUpdatedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  if (payload.key !== "gitCommitMessageModel" && payload.key !== "favoriteFolders") {
    return currentState;
  }

  const nextSelection =
    payload.key === "gitCommitMessageModel"
      ? payload.reset === true
        ? null
        : typeof payload.provider === "string" && typeof payload.modelId === "string"
          ? { provider: payload.provider, id: payload.modelId }
          : currentState.appSettings.gitCommitMessageModel
      : currentState.appSettings.gitCommitMessageModel;

  const nextFavoriteFolders =
    payload.key === "favoriteFolders" && Array.isArray(payload.folders)
      ? [
          ...new Set(
            payload.folders
              .filter((folder): folder is string => typeof folder === "string")
              .map((folder) => folder.trim())
              .filter(Boolean),
          ),
        ]
      : currentState.appSettings.favoriteFolders;

  return {
    ...currentState,
    appSettings: {
      ...currentState.appSettings,
      gitCommitMessageModel: nextSelection,
      favoriteFolders: nextFavoriteFolders,
    },
  } satisfies ShellState;
}

export function applyOptimisticSettingsUpdate(
  queryClient: QueryClient,
  payload: Record<string, unknown>,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  );
}

type RunPostDesktopActionEffectsInput = {
  action: DesktopAction;
  contextualPayload: ActionPayload;
  actionResult: DesktopActionResult | null;
  workspaceState: WorkspaceState;
  composerProjectId: string;
  dispatch: Dispatch<WorkspaceAction>;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  loadComposerState: (request?: { projectId?: string | null }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  refreshShellState: () => Promise<unknown>;
  setArchivedThreads: (threads: ArchivedThread[]) => void;
  setComposerState: (state: ComposerState | null) => void;
  setProjectGitState: (state: ProjectGitState | null) => void;
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
  setProjectGitState,
}: RunPostDesktopActionEffectsInput) {
  if (action === "thread.pin" || action === "thread.archive") {
    const projectId = getPayloadProjectId(contextualPayload);
    if (projectId) {
      await loadProjectThreads(projectId);
    }

    if (action === "thread.archive") {
      await refreshArchivedThreadsIfOpen({
        archivedThreadsOpen: workspaceState.archivedThreadsOpen,
        loadArchivedThreads,
        setArchivedThreads,
      });
    }

    if (
      action === "thread.archive" &&
      contextualPayload.threadId === workspaceState.selectedThreadId
    ) {
      dispatch({ type: "show-view", view: "code" });
    }
  }

  if (action === "thread.restore" || action === "thread.delete") {
    setArchivedThreads(await loadArchivedThreads());

    const projectId = getPayloadProjectId(contextualPayload);
    if (projectId) {
      await loadProjectThreads(projectId);
    }

    if (
      action === "thread.delete" &&
      contextualPayload.threadId === workspaceState.selectedThreadId
    ) {
      dispatch({ type: "show-view", view: "code" });
    }
  }

  if (action === "project.edit-name") {
    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsOpen: workspaceState.archivedThreadsOpen,
      loadArchivedThreads,
      setArchivedThreads,
    });
  }

  if (action === "project.archive-threads") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId) {
      await loadProjectThreads(projectId);
    }

    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsOpen: workspaceState.archivedThreadsOpen,
      loadArchivedThreads,
      setArchivedThreads,
    });

    if (contextualPayload.projectId === workspaceState.selectedProjectId) {
      dispatch({ type: "show-view", view: "code" });
    }
  }

  if (action === "project.remove-project") {
    if (contextualPayload.projectId === workspaceState.selectedProjectId) {
      dispatch({ type: "show-view", view: "code" });
    }

    await refreshShellState();
    await refreshArchivedThreadsIfOpen({
      archivedThreadsOpen: workspaceState.archivedThreadsOpen,
      loadArchivedThreads,
      setArchivedThreads,
    });
  }

  if (action === "settings.update") {
    await refreshShellState();
  }

  if (action === "thread.new") {
    const projectId = getPayloadProjectId(contextualPayload) ?? composerProjectId;
    const sessionPath =
      typeof actionResult?.result?.sessionPath === "string"
        ? actionResult.result.sessionPath
        : null;
    const threadId =
      typeof actionResult?.result?.threadId === "string" ? actionResult.result.threadId : null;
    const localFallback =
      !threadId && !sessionPath && projectId && !hasElectrobunDesktopBridge()
        ? buildLocalThreadFallback(projectId)
        : null;

    if (projectId && threadId && sessionPath) {
      dispatch({ type: "open-thread", projectId, threadId, sessionPath });
      await loadProjectThreads(projectId);
    } else if (localFallback) {
      dispatch({
        type: "open-thread",
        projectId: localFallback.projectId,
        threadId: localFallback.threadId,
        sessionPath: localFallback.sessionPath,
      });
    } else if (projectId) {
      dispatch({ type: "select-project", projectId });
      await loadProjectThreads(projectId);
    } else {
      dispatch({ type: "show-view", view: "code" });
    }

    if (!localFallback) {
      const nextComposerState = await loadComposerState({ projectId });
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
  }

  if (action === "workspace.commit") {
    const projectId = getPayloadProjectId(contextualPayload);

    if (projectId && actionResult?.result?.committed === true) {
      setProjectGitState(await loadProjectGitState(projectId));
    }
  }
}
