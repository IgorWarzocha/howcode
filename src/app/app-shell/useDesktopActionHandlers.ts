import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PendingProjectDialog } from "../components/sidebar/ProjectActionDialog";
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
import type { Project, View } from "../types";
import {
  buildContextualActionPayload,
  buildPendingProjectAction,
  shouldConfirmProjectAction,
} from "./controller-action-helpers";
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
  projects: Project[];
  refreshShellState: () => Promise<unknown>;
  selectedSessionPath: string | null;
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
  workspaceState: WorkspaceState;
};

export function useDesktopActionHandlers({
  activeView,
  composerProjectId,
  dispatch,
  invokeDesktopAction,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  loadProjectThreads,
  projects,
  refreshShellState,
  selectedSessionPath,
  setArchivedThreads,
  setComposerState,
  setProjectGitState,
  workspaceState,
}: UseDesktopActionHandlersArgs) {
  const queryClient = useQueryClient();
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectDialog | null>(
    null,
  );

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
      });

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
      workspaceState,
    ],
  );

  const handleAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      // Optimistic updates happen before the desktop call so the renderer stays stable
      // while the background write and refresh pipeline converges.
      if (shouldConfirmProjectAction(action)) {
        const nextPendingProjectAction = buildPendingProjectAction(action, payload, projects);
        if (!nextPendingProjectAction) {
          return null;
        }

        setPendingProjectAction(nextPendingProjectAction);
        return null;
      }

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
    [projects, queryClient, runDesktopAction],
  );

  const handleConfirmProjectAction = useCallback(
    async (payload: ActionPayload = {}) => {
      if (!pendingProjectAction) {
        return;
      }

      const nextAction = pendingProjectAction;
      setPendingProjectAction(null);

      await runDesktopAction(nextAction.action, {
        projectId: nextAction.projectId,
        projectName: nextAction.projectName,
        ...payload,
      });
    },
    [pendingProjectAction, runDesktopAction],
  );

  return {
    handleAction,
    handleConfirmProjectAction,
    pendingProjectAction,
    runDesktopAction,
    setPendingProjectAction,
  };
}
