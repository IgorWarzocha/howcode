import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";

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
  projectId: string;
  sessionPath: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  onAction: DesktopActionInvoker;
  clearStoredDraft: (threadId: string) => void;
};

export async function submitComposerDraft({
  draft,
  attachments,
  draftThreadId,
  isSending,
  projectId,
  sessionPath,
  streamingBehaviorPreference,
  onAction,
  clearStoredDraft,
}: SubmitComposerDraftOptions): Promise<SubmitComposerDraftResult> {
  const text = draft.trim();
  if ((text.length === 0 && attachments.length === 0) || isSending) {
    return { status: "skipped" };
  }

  try {
    const actionResult = await onAction("composer.send", {
      text,
      attachments,
      projectId,
      sessionPath,
      streamingBehavior: streamingBehaviorPreference,
    });

    const actionErrorMessage = getDesktopActionErrorMessage(actionResult, "Could not send prompt.");
    if (actionErrorMessage) {
      return {
        status: "error",
        errorMessage: actionErrorMessage,
        text,
      };
    }

    if (actionResult?.result?.composerSendOutcome === "stopped") {
      return { status: "stopped", text };
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
