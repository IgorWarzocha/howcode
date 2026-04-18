import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { DesktopActionInvoker, ProjectGitState } from "../../../desktop/types";
import type { SavedDiffComment } from "../diff/diffCommentStore";
import {
  buildGitOpsCommentCards,
  getActionResultCommitted,
  getActionResultError,
  getActionResultMessage,
  getActionResultPreviewed,
} from "./composer-git-ops.helpers";

export function useComposerGitOpsState({
  diffComments,
  diffCommentsSending,
  onAction,
  onSendDiffComments,
  projectGitState,
}: {
  diffComments: SavedDiffComment[];
  diffCommentsSending: boolean;
  onAction: DesktopActionInvoker;
  onSendDiffComments: (message?: string | null) => void;
  projectGitState: ProjectGitState | null;
}) {
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitFocused, setCommitFocused] = useState(false);
  const [previewPendingCommit, setPreviewPendingCommit] = useState(false);
  const [persistedCleanMessage, setPersistedCleanMessage] = useState<string | null>(null);
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const previousProjectIdRef = useRef<string | null>(projectGitState?.projectId ?? null);
  const commitMessageRef = useRef(commitMessage);

  commitMessageRef.current = commitMessage;

  const isGitRepo = projectGitState?.isGitRepo ?? false;
  const hasOrigin = projectGitState?.hasOrigin ?? false;
  const isGitHubOrigin = projectGitState?.originUrl?.includes("github.com") ?? false;
  const isTreeClean = isGitRepo && (projectGitState?.fileCount ?? 0) === 0;
  const hasDiffComments = diffComments.length > 0;
  const trimmedCommitMessage = commitMessage.trim();
  const canCommit =
    isGitRepo &&
    (includeUnstaged
      ? (projectGitState?.fileCount ?? 0) > 0
      : (projectGitState?.stagedFileCount ?? 0) > 0);
  const commitLabel = pushEnabled ? "Commit & push" : "Commit";
  const primaryActionLabel = hasDiffComments
    ? diffCommentsSending
      ? "Sending comments…"
      : "Send comments"
    : !isGitRepo
      ? "Init git"
      : canCommit || (projectGitState?.fileCount ?? 0) > 0
        ? commitLabel
        : "Clean";
  const commentCards = useMemo(() => buildGitOpsCommentCards(diffComments), [diffComments]);

  useEffect(() => {
    if (!hasOrigin) {
      setPushEnabled(false);
    }
  }, [hasOrigin]);

  useEffect(() => {
    const nextProjectId = projectGitState?.projectId ?? null;
    if (previousProjectIdRef.current === nextProjectId) {
      return;
    }

    previousProjectIdRef.current = nextProjectId;
    setCommitMessage("");
    setCommitFocused(false);
    setPersistedCleanMessage(null);
    setPreviewPendingCommit(false);
  }, [projectGitState]);

  useEffect(() => {
    if (!isTreeClean && persistedCleanMessage && commitMessage === persistedCleanMessage) {
      setCommitMessage("");
      setPersistedCleanMessage(null);
    }
  }, [commitMessage, isTreeClean, persistedCleanMessage]);

  const handleCommitMessageChange = useCallback(
    (nextMessage: string) => {
      setCommitMessage(nextMessage);
      if (actionErrorMessage) {
        setActionErrorMessage(null);
      }
      if (nextMessage.trim().length === 0) {
        setPreviewPendingCommit(false);
      }
      if (persistedCleanMessage && nextMessage !== persistedCleanMessage) {
        setPersistedCleanMessage(null);
      }
    },
    [actionErrorMessage, persistedCleanMessage],
  );

  const setCommitMessageValue = useCallback(
    (value: SetStateAction<string>) => {
      const nextMessage = typeof value === "function" ? value(commitMessageRef.current) : value;

      handleCommitMessageChange(nextMessage);
    },
    [handleCommitMessageChange],
  );

  const handleSaveOrigin = useCallback(async () => {
    const nextRepoUrl = repoUrl.trim();
    if (!isGitRepo || nextRepoUrl.length === 0) {
      return;
    }

    try {
      await onAction("workspace.commit-options", { repoUrl: nextRepoUrl });
      setActionErrorMessage(null);
      setRepoUrl("");
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Could not update the repository remote.",
      );
    }
  }, [isGitRepo, onAction, repoUrl]);

  const handlePrimaryAction = useCallback(async () => {
    if (hasDiffComments) {
      onSendDiffComments(trimmedCommitMessage);
      return;
    }

    if (runningPrimaryAction) {
      return;
    }

    if (!isGitRepo) {
      try {
        await onAction("workspace.commit-options");
        setActionErrorMessage(null);
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Could not initialize git.");
      }
      return;
    }

    if (!canCommit) {
      return;
    }

    const shouldPreview =
      previewEnabled && trimmedCommitMessage.length === 0 && !previewPendingCommit;

    setRunningPrimaryAction(true);

    try {
      setActionErrorMessage(null);
      const result = await onAction("workspace.commit", {
        includeUnstaged,
        message: trimmedCommitMessage.length > 0 ? trimmedCommitMessage : null,
        preview: shouldPreview,
        push: pushEnabled,
      });

      const nextMessage = getActionResultMessage(result);
      if (nextMessage) {
        setCommitMessage(nextMessage);
        setCommitFocused(false);
      }

      if (getActionResultPreviewed(result)) {
        setPreviewPendingCommit(true);
        return;
      }

      if (getActionResultCommitted(result)) {
        setPreviewPendingCommit(false);
        const finalMessage =
          nextMessage ?? (trimmedCommitMessage.length > 0 ? trimmedCommitMessage : null);
        if (finalMessage) {
          setCommitMessage(finalMessage);
          setPersistedCleanMessage(finalMessage);
        }
      }
      setActionErrorMessage(getActionResultError(result));
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Could not commit changes.");
    } finally {
      setRunningPrimaryAction(false);
    }
  }, [
    canCommit,
    hasDiffComments,
    includeUnstaged,
    isGitRepo,
    onAction,
    onSendDiffComments,
    previewEnabled,
    previewPendingCommit,
    pushEnabled,
    runningPrimaryAction,
    trimmedCommitMessage,
  ]);

  const togglePreviewEnabled = useCallback(() => {
    setPreviewEnabled((current) => !current);
    setPreviewPendingCommit(false);
  }, []);

  return {
    actionErrorMessage,
    canCommit,
    commentCards,
    commitFocused,
    commitMessage,
    handleCommitMessageChange,
    handlePrimaryAction,
    handleSaveOrigin,
    hasDiffComments,
    hasOrigin,
    includeUnstaged,
    isGitHubOrigin,
    isGitRepo,
    previewEnabled,
    primaryActionLabel,
    projectGitState,
    pushEnabled,
    repoUrl,
    runningPrimaryAction,
    setCommitFocused,
    setActionErrorMessage,
    setIncludeUnstaged,
    setCommitMessageValue,
    setPushEnabled,
    setRepoUrl,
    togglePreviewEnabled,
  };
}
