import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";
import type { DesktopAction } from "../desktop/actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerState,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
} from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import { refreshArchivedThreadsIfOpen } from "./controller-action-helpers";

type ActionPayload = AnyDesktopActionPayload;

function getPayloadProjectId(payload: ActionPayload) {
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

function getPayloadThreadId(payload: ActionPayload) {
  return typeof payload.threadId === "string" ? payload.threadId : null;
}

function sortPinnedThreads<T extends { id: string; pinned?: boolean }>(threads: T[]) {
  return [...threads].sort((left, right) => {
    const leftPinned = Boolean(left.pinned);
    const rightPinned = Boolean(right.pinned);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return 0;
  });
}

function sortPinnedProjects<T extends { id: string; pinned?: boolean }>(projects: T[]) {
  return [...projects].sort((left, right) => {
    const leftPinned = Boolean(left.pinned);
    const rightPinned = Boolean(right.pinned);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return 0;
  });
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

  if (
    payload.key !== "gitCommitMessageModel" &&
    payload.key !== "skillCreatorModel" &&
    payload.key !== "favoriteFolders" &&
    payload.key !== "projectImportState" &&
    payload.key !== "preferredProjectLocation" &&
    payload.key !== "initializeGitOnProjectCreate" &&
    payload.key !== "useAgentsSkillsPaths"
  ) {
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

  const nextSkillCreatorSelection =
    payload.key === "skillCreatorModel"
      ? payload.reset === true
        ? null
        : typeof payload.provider === "string" && typeof payload.modelId === "string"
          ? { provider: payload.provider, id: payload.modelId }
          : currentState.appSettings.skillCreatorModel
      : currentState.appSettings.skillCreatorModel;

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

  const nextProjectImportState =
    payload.key === "projectImportState" &&
    (payload.imported === null || typeof payload.imported === "boolean")
      ? payload.imported
      : currentState.appSettings.projectImportState;

  const nextPreferredProjectLocation =
    payload.key === "preferredProjectLocation"
      ? typeof payload.value === "string"
        ? payload.value.trim() || null
        : null
      : currentState.appSettings.preferredProjectLocation;

  const nextInitializeGitOnProjectCreate =
    payload.key === "initializeGitOnProjectCreate" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.initializeGitOnProjectCreate;

  const nextUseAgentsSkillsPaths =
    payload.key === "useAgentsSkillsPaths" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.useAgentsSkillsPaths;

  return {
    ...currentState,
    appSettings: {
      ...currentState.appSettings,
      gitCommitMessageModel: nextSelection,
      skillCreatorModel: nextSkillCreatorSelection,
      favoriteFolders: nextFavoriteFolders,
      projectImportState: nextProjectImportState,
      preferredProjectLocation: nextPreferredProjectLocation,
      initializeGitOnProjectCreate: nextInitializeGitOnProjectCreate,
      useAgentsSkillsPaths: nextUseAgentsSkillsPaths,
    },
  } satisfies ShellState;
}

export function applyOptimisticSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  );
}

export function getOptimisticallyRenamedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  const projectId = getPayloadProjectId(payload);
  const projectName = typeof payload.projectName === "string" ? payload.projectName.trim() : "";

  if (!projectId || projectName.length === 0) {
    return currentState;
  }

  return {
    ...currentState,
    projects: currentState.projects.map((project) =>
      project.id === projectId ? { ...project, name: projectName } : project,
    ),
  } satisfies ShellState;
}

export function applyOptimisticProjectRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedShellState(currentState ?? null, payload),
  );
}

export function getOptimisticallyPinnedShellState(
  currentState: ShellState | null,
  action: DesktopAction,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  if (action === "thread.pin") {
    const projectId = getPayloadProjectId(payload);
    const threadId = getPayloadThreadId(payload);

    if (!projectId || !threadId) {
      return currentState;
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const nextThreads = sortPinnedThreads(
          project.threads.map((thread) =>
            thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
          ),
        );

        return {
          ...project,
          threads: nextThreads,
        };
      }),
    } satisfies ShellState;
  }

  if (action === "project.pin") {
    const projectId = getPayloadProjectId(payload);

    if (!projectId) {
      return currentState;
    }

    return {
      ...currentState,
      projects: sortPinnedProjects(
        currentState.projects.map((project) =>
          project.id === projectId ? { ...project, pinned: !project.pinned } : project,
        ),
      ),
    } satisfies ShellState;
  }

  return currentState;
}

export function applyOptimisticPinUpdate(
  queryClient: QueryClient,
  action: DesktopAction,
  payload: ActionPayload,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyPinnedShellState(currentState ?? null, action, payload),
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
  setProjectGitState,
  queryClient,
}: RunPostDesktopActionEffectsInput) {
  const invalidateInboxThreads = () =>
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() });

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

    await invalidateInboxThreads();
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
      archivedThreadsOpen: workspaceState.archivedThreadsOpen,
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
      archivedThreadsOpen: workspaceState.archivedThreadsOpen,
      loadArchivedThreads,
      setArchivedThreads,
    });

    if (contextualPayload.projectId === workspaceState.selectedProjectId) {
      dispatch({ type: "show-view", view: "code" });
    }

    await invalidateInboxThreads();
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

    await invalidateInboxThreads();
  }

  if (action === "settings.update") {
    await refreshShellState();
  }

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
      !threadId && !sessionPath && projectId && !hasElectrobunDesktopBridge()
        ? buildLocalThreadFallback(projectId)
        : null;

    if (action === "project.add") {
      await refreshShellState();
    }

    if ((resultProjectId ?? projectId) && threadId && sessionPath) {
      const nextProjectId = resultProjectId ?? projectId;
      dispatch({ type: "open-thread", projectId: nextProjectId, threadId, sessionPath });
      await loadProjectThreads(nextProjectId);
    } else if (localFallback) {
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
