import type { DesktopAction } from "../../../desktop/actions";
import type { ComposerAttachment, DesktopActionResult } from "../../../desktop/types";

type SubmitComposerDraftResult =
  | { status: "skipped" }
  | { status: "sent"; text: string }
  | { status: "error"; errorMessage: string; text: string };

type SubmitComposerDraftOptions = {
  draft: string;
  attachments: ComposerAttachment[];
  draftThreadId: string | null;
  isSending: boolean;
  projectId: string;
  sessionPath: string | null;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  clearStoredDraft: (threadId: string) => void;
};

export async function submitComposerDraft({
  draft,
  attachments,
  draftThreadId,
  isSending,
  projectId,
  sessionPath,
  onAction,
  clearStoredDraft,
}: SubmitComposerDraftOptions): Promise<SubmitComposerDraftResult> {
  const text = draft.trim();
  if (!text || isSending) {
    return { status: "skipped" };
  }

  try {
    await onAction("composer.send", {
      text,
      attachments,
      projectId,
      sessionPath,
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
