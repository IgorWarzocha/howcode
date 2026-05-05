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
  ChatSidebarState,
  ProjectGitState,
  ThreadData,
} from "../desktop/types";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";
import type { View } from "../types";
import { cleanUserErrorMessage } from "../desktop/error-messages";
import { buildContextualActionPayload } from "./controller-action-helpers";
import { buildLocalThreadFallback } from "./controller-action-utils";
import {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  runPostDesktopActionEffects,
} from "./controller-post-action-effects";
import { applyChatThreadToSidebarState } from "./chat-sidebar-cache";
import { applyProjectThreadToShellState } from "./project-thread-cache";

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
    composerMode?: "chat" | "code" | null;
  }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>;
  refreshShellState: () => Promise<unknown>;
  selectedSessionPath: string | null;
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>;
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
  showToast: (message: string) => void;
  workspaceState: WorkspaceState;
};

function getActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (!actionResult) {
    return null;
  }

  if (actionResult.ok === false && typeof actionResult.result?.error === "string") {
    return cleanUserErrorMessage(actionResult.result.error);
  }

  return typeof actionResult.result?.error === "string"
    ? cleanUserErrorMessage(actionResult.result.error)
    : null;
}

function shouldShowGlobalActionError(action: DesktopAction) {
  return !(
    action === "composer.send" ||
    action === "composer.stop" ||
    action === "workspace.commit" ||
    action === "workspace.commit-options" ||
    action === "workspace.diff-preferences"
  );
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
  setChatSidebarState,
  setLiveThreadData,
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
      let contextualPayload = buildContextualActionPayload({
        action,
        payload,
        composerProjectId,
        activeView,
        selectedSessionPath,
      });

      if (
        action === "composer.send" &&
        activeView !== "inbox" &&
        typeof contextualPayload.projectId === "string" &&
        !contextualPayload.sessionPath
      ) {
        const localFallback = buildLocalThreadFallback(contextualPayload.projectId, {
          chatGroupId:
            activeView === "chat" ? (contextualPayload.chatGroupId as string | null) : null,
        });
        contextualPayload = { ...contextualPayload, sessionPath: localFallback.sessionPath };
        const optimisticThread = {
          id: localFallback.threadId,
          title: "New thread",
          age: "Now",
          lastModifiedMs: Date.now(),
          sessionPath: localFallback.sessionPath,
          running: true,
        };
        applyProjectThreadToShellState(queryClient, localFallback.projectId, optimisticThread, {
          revealProject: true,
        });
        if (activeView === "chat") {
          setChatSidebarState((current) =>
            applyChatThreadToSidebarState(current, {
              ...optimisticThread,
              projectId: localFallback.projectId,
              groupId:
                typeof contextualPayload.chatGroupId === "string"
                  ? contextualPayload.chatGroupId
                  : null,
            }),
          );
        }
        setLiveThreadData(() => ({
          sessionPath: localFallback.sessionPath,
          title: "New thread",
          messages: [
            {
              id: `${localFallback.threadId}:user`,
              role: "user",
              content: typeof contextualPayload.text === "string" ? [contextualPayload.text] : [],
            },
          ],
          previousMessageCount: 0,
          isStreaming: true,
          isCompacting: false,
        }));
        dispatch({
          type: "open-thread",
          projectId: localFallback.projectId,
          threadId: localFallback.threadId,
          sessionPath: localFallback.sessionPath,
          view: activeView === "chat" ? "chat" : "thread",
        });
      }

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
        setChatSidebarState,
        setLiveThreadData,
        setProjectGitState,
        queryClient,
      });

      const actionErrorMessage = getActionErrorMessage(actionResult);
      if (actionErrorMessage && shouldShowGlobalActionError(action)) {
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
      setChatSidebarState,
      setLiveThreadData,
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

      if (action === "pi-settings.update") {
        applyOptimisticPiSettingsUpdate(queryClient, payload);
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
