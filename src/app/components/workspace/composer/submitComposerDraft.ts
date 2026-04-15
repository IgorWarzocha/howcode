import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
  DesktopActionResult,
} from "../../../desktop/types";

type SubmitComposerDraftResult =
  | { status: "skipped" }
  | { status: "sent"; text: string }
  | { status: "stopped"; text: string }
  | { status: "error"; errorMessage: string; text: string };

type SubmitComposerDraftOptions = {
  draft: string;
  attachments: ComposerAttachment[];
  draftThreadId: string | null;
  isSending: boolean;
  isStreaming: boolean;
  projectId: string;
  sessionPath: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  onAction: DesktopActionInvoker;
  clearStoredDraft: (threadId: string) => void;
};

function getDesktopActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (actionResult?.ok === false && typeof actionResult.result?.error === "string") {
    return actionResult.result.error;
  }

  if (typeof actionResult?.result?.error === "string") {
    return actionResult.result.error;
  }

  return actionResult?.ok === false ? "Could not send prompt." : null;
}

export async function submitComposerDraft({
  draft,
  attachments,
  draftThreadId,
  isSending,
  isStreaming,
  projectId,
  sessionPath,
  streamingBehaviorPreference,
  onAction,
  clearStoredDraft,
}: SubmitComposerDraftOptions): Promise<SubmitComposerDraftResult> {
  const text = draft.trim();
  if (!text || isSending) {
    return { status: "skipped" };
  }

  try {
    if (isStreaming && streamingBehaviorPreference === "stop") {
      const actionResult = await onAction("composer.stop", {
        projectId,
        sessionPath,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(actionResult);
      if (actionErrorMessage) {
        return {
          status: "error",
          errorMessage: actionErrorMessage,
          text,
        };
      }

      return { status: "stopped", text };
    }

    const actionResult = await onAction("composer.send", {
      text,
      attachments,
      projectId,
      sessionPath,
      streamingBehavior: streamingBehaviorPreference,
    });

    const actionErrorMessage = getDesktopActionErrorMessage(actionResult);
    if (actionErrorMessage) {
      return {
        status: "error",
        errorMessage: actionErrorMessage,
        text,
      };
    }

    if (draftThreadId) {
      clearStoredDraft(draftThreadId);
    }

    return { status: "sent", text };
  } catch (error) {
    return {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Could not send prompt.",
      text,
    };
  }
}
