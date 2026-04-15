import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
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
      await onAction("composer.stop", {
        projectId,
        sessionPath,
      });

      return { status: "stopped", text };
    }

    await onAction("composer.send", {
      text,
      attachments,
      projectId,
      sessionPath,
      streamingBehavior: streamingBehaviorPreference,
    });

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
