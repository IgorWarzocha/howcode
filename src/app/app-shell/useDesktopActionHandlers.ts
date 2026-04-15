import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DesktopAction } from "../desktop/actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerState,
  DesktopActionInvoker,
  DesktopActionResult,
  ProjectGitState,
} from "../desktop/types";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { View } from "../types";
import { buildContextualActionPayload } from "./controller-action-helpers";
import {
  applyOptimisticPinUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  runPostDesktopActionEffects,
} from "./controller-post-action-effects";

type ActionPayload = AnyDesktopActionPayload;

type UseDesktopActionHandlersArgs = {
  activeView: View;
  composerProjectId: string;
  dispatch: Dispatch<WorkspaceAction>;
  invokeDesktopAction: DesktopActionInvoker;
  loadArchivedThreads: () => Promise<ArchivedThread[]>;
  loadComposerState: (request?: {
    projectId?: string | null;
    sessionPath?: string | null;
  }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectThreads: (projectId: string) => Promise<unknown>;
  refreshShellState: () => Promise<unknown>;
  selectedSessionPath: string | null;
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
  showToast: (message: string) => void;
  workspaceState: WorkspaceState;
};

function getActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (!actionResult) {
    return null;
  }

  if (actionResult.ok === false && typeof actionResult.result?.error === "string") {
    return actionResult.result.error;
  }

  return typeof actionResult.result?.error === "string" ? actionResult.result.error : null;
}

export function useDesktopActionHandlers({
  activeView,
  composerProjectId,
  dispatch,
  invokeDesktopAction,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  loadProjectThreads,
  refreshShellState,
  selectedSessionPath,
  setArchivedThreads,
  setComposerState,
  setProjectGitState,
  showToast,
  workspaceState,
}: UseDesktopActionHandlersArgs) {
  const queryClient = useQueryClient();

  const runDesktopAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      // Build the renderer-context payload first so optimistic UI and desktop writes
      // operate against the same project/session selection.
      const contextualPayload = buildContextualActionPayload({
        action,
        payload,
        composerProjectId,
        activeView,
        selectedSessionPath,
      });

      const actionResult = await invokeDesktopAction(action, contextualPayload);

      await runPostDesktopActionEffects({
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
      });

      const actionErrorMessage = getActionErrorMessage(actionResult);
      if (actionErrorMessage) {
        showToast(actionErrorMessage);
      }

      return actionResult;
    },
    [
      activeView,
      composerProjectId,
      dispatch,
      invokeDesktopAction,
      loadArchivedThreads,
      loadComposerState,
      loadProjectGitState,
      loadProjectThreads,
      refreshShellState,
      selectedSessionPath,
      setArchivedThreads,
      setComposerState,
      setProjectGitState,
      showToast,
      workspaceState,
      queryClient,
    ],
  );

  const handleAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      // Optimistic updates happen before the desktop call so the renderer stays stable
      // while the background write and refresh pipeline converges.
      if (action === "settings.update") {
        applyOptimisticSettingsUpdate(queryClient, payload);
      }

      if (action === "project.edit-name") {
        applyOptimisticProjectRename(queryClient, payload);
      }

      if (action === "thread.pin" || action === "project.pin") {
        applyOptimisticPinUpdate(queryClient, action, payload);
      }

      return await runDesktopAction(action, payload);
    },
    [queryClient, runDesktopAction],
  );

  return {
    handleAction,
    runDesktopAction,
  };
}
