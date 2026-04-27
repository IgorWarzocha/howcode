import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ComposerState, InboxThread, ProjectGitState } from "../desktop/types";
import type { WorkspaceState } from "../state/workspace";

type UseComposerGitStateSyncInput = {
  workspaceState: WorkspaceState;
  selectedInboxThread: InboxThread | null;
  composerProjectId: string;
  shellComposerState: ComposerState | null | undefined;
  loadComposerState: (request?: {
    projectId?: string | null;
    sessionPath?: string | null;
  }) => Promise<ComposerState | null>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>;
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>;
};

export function useComposerGitStateSync({
  workspaceState,
  selectedInboxThread,
  composerProjectId,
  shellComposerState,
  loadComposerState,
  loadProjectGitState,
  setComposerState,
  setProjectGitState,
}: UseComposerGitStateSyncInput) {
  useEffect(() => {
    if (!shellComposerState) {
      return;
    }

    setComposerState((current) => current ?? shellComposerState);
  }, [setComposerState, shellComposerState]);

  useEffect(() => {
    const inboxProjectId = selectedInboxThread?.projectId ?? null;
    const inboxSessionPath = selectedInboxThread?.sessionPath ?? null;
    const composerStateProjectId =
      workspaceState.activeView === "inbox" ? inboxProjectId : composerProjectId;
    const composerStateSessionPath =
      workspaceState.activeView === "thread" || workspaceState.activeView === "gitops"
        ? workspaceState.selectedSessionPath
        : workspaceState.activeView === "inbox"
          ? inboxSessionPath
          : null;

    if (!composerStateProjectId) {
      return;
    }

    let cancelled = false;

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: composerStateProjectId,
        sessionPath: composerStateSessionPath,
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
    loadComposerState,
    composerProjectId,
    selectedInboxThread?.projectId,
    selectedInboxThread?.sessionPath,
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
}
