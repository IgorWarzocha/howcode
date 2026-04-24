import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { getDesktopActionErrorMessage } from "../../desktop/action-results";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { buildDiffCommentPrompt } from "../../components/workspace/diff/diffCommentPrompt";
import {
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "../../components/workspace/diff/diffCommentStore";

export function useDiffCommentController({
  composerProjectId,
  handleAction,
  handleOpenWorktreeDiffFile,
  setComposerPromptResetKey,
  shellState,
}: {
  composerProjectId: string;
  handleAction: AppShellController["handleAction"];
  handleOpenWorktreeDiffFile: (filePath: string) => void;
  setComposerPromptResetKey: Dispatch<SetStateAction<number>>;
  shellState: AppShellController["shellState"];
}) {
  const [diffComments, setDiffComments] = useState<SavedDiffComment[]>([]);
  const [diffCommentCount, setDiffCommentCount] = useState(0);
  const [selectedDiffCommentId, setSelectedDiffCommentId] = useState<string | null>(null);
  const [selectedDiffCommentJumpKey, setSelectedDiffCommentJumpKey] = useState(0);
  const [diffCommentsSending, setDiffCommentsSending] = useState(false);
  const [diffCommentError, setDiffCommentError] = useState<string | null>(null);
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ projectId: composerProjectId }),
    [composerProjectId],
  );

  useEffect(() => {
    const syncCommentCount = () => {
      if (!diffCommentContextId) {
        setDiffComments([]);
        setDiffCommentCount(0);
        return;
      }

      const nextComments = diffCommentStore.getContext(diffCommentContextId)?.comments ?? [];
      setDiffComments(nextComments);
      setDiffCommentCount(nextComments.length);
    };

    setSelectedDiffCommentId(null);
    setSelectedDiffCommentJumpKey(0);
    syncCommentCount();
    return diffCommentStore.subscribe(syncCommentCount);
  }, [diffCommentContextId]);

  const handleSendDiffComments = async (message?: string | null) => {
    if (!diffCommentContextId || diffCommentsSending) {
      return;
    }

    const context = diffCommentStore.getContext(diffCommentContextId);
    if (!context || context.comments.length === 0) {
      return;
    }

    setDiffCommentsSending(true);
    setDiffCommentError(null);
    setSelectedDiffCommentId(null);
    setComposerPromptResetKey((current) => current + 1);

    try {
      const streamingBehaviorPreference =
        shellState?.appSettings.composerStreamingBehavior ?? "followUp";
      const result = await handleAction("composer.send", {
        text: buildDiffCommentPrompt({ comments: context.comments, instruction: message }),
        streamingBehavior: streamingBehaviorPreference,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(
        result,
        "Could not send comments to the agent.",
      );
      if (actionErrorMessage) {
        setDiffCommentError(actionErrorMessage);
        return;
      }

      if (result?.result?.composerSendOutcome === "stopped") {
        return;
      }

      diffCommentStore.clearContext(diffCommentContextId);
    } catch (error) {
      setDiffCommentError(
        error instanceof Error ? error.message : "Could not send comments to the agent.",
      );
    } finally {
      setDiffCommentsSending(false);
    }
  };

  const handleSelectDiffComment = (filePath: string, commentId: string) => {
    setSelectedDiffCommentId(commentId);
    setSelectedDiffCommentJumpKey((current) => current + 1);
    handleOpenWorktreeDiffFile(filePath);
  };

  return {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  };
}
