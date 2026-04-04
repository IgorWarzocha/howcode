import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionResult,
} from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { composerDraftStore, getComposerDraftThreadId } from "./composerDraftStore";
import { submitComposerDraft } from "./submitComposerDraft";

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
};

function getModelLabel(model: ComposerModel | null) {
  if (!model) {
    return "No model";
  }

  return model.name;
}

type UseComposerControllerProps = {
  model: ComposerModel | null;
  projectId: string;
  sessionPath: string | null;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
};

export function useComposerController({
  model,
  projectId,
  sessionPath,
  onAction,
  onPickAttachments,
}: UseComposerControllerProps) {
  const draftThreadId = useMemo(
    () => getComposerDraftThreadId({ projectId, sessionPath }),
    [projectId, sessionPath],
  );
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [openMenu, setOpenMenu] = useState<"model" | "thinking" | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const thinkingButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const thinkingMenuRef = useRef<HTMLDivElement>(null);
  const activeDraftThreadIdRef = useRef<string | null>(draftThreadId);
  const skipNextDraftPersistenceRef = useRef<string | null>(null);

  activeDraftThreadIdRef.current = draftThreadId;

  useEffect(() => {
    skipNextDraftPersistenceRef.current = draftThreadId;

    const persistedDraft = draftThreadId ? composerDraftStore.getDraft(draftThreadId) : null;
    setDraft(persistedDraft?.prompt ?? "");
    setAttachments(persistedDraft?.attachments ?? []);
    setErrorMessage(null);
  }, [draftThreadId]);

  useEffect(() => {
    if (!draftThreadId) {
      return;
    }

    if (skipNextDraftPersistenceRef.current === draftThreadId) {
      skipNextDraftPersistenceRef.current = null;
      return;
    }

    composerDraftStore.setDraft(draftThreadId, { prompt: draft, attachments });
  }, [attachments, draft, draftThreadId]);

  useDismissibleLayer({
    open: openMenu !== null,
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, thinkingButtonRef, modelMenuRef, thinkingMenuRef],
  });

  const canSend = draft.trim().length > 0 && !isSending;

  const runComposerAction = async (action: DesktopAction, payload: Record<string, unknown>) => {
    try {
      await onAction(action, payload);
      setErrorMessage(null);
      setOpenMenu(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update the composer.");
    }
  };

  const send = async () => {
    if (draft.trim().length === 0 || isSending) {
      return;
    }

    const submittedAttachments = attachments;
    const submittedDraftThreadId = draftThreadId;

    setIsSending(true);
    setErrorMessage(null);
    skipNextDraftPersistenceRef.current = submittedDraftThreadId;
    setDraft("");
    setAttachments([]);

    const result = await submitComposerDraft({
      draft,
      attachments: submittedAttachments,
      draftThreadId: submittedDraftThreadId,
      isSending,
      projectId,
      sessionPath,
      onAction,
      clearStoredDraft: (threadId) => composerDraftStore.clearThreadDraft(threadId),
    });

    if (result.status === "error" && activeDraftThreadIdRef.current === submittedDraftThreadId) {
      setDraft((currentDraft) => (currentDraft.length === 0 ? result.text : currentDraft));
      setAttachments((currentAttachments) =>
        currentAttachments.length === 0 ? submittedAttachments : currentAttachments,
      );
      setErrorMessage(result.errorMessage);
    }

    setIsSending(false);
  };

  const pickAttachments = async () => {
    let nextAttachments: ComposerAttachment[] = [];

    try {
      nextAttachments = await onPickAttachments(projectId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not open the file picker.");
      return;
    }

    if (nextAttachments.length === 0) {
      return;
    }

    setAttachments((current) => {
      const byPath = new Map(current.map((attachment) => [attachment.path, attachment]));

      for (const attachment of nextAttachments) {
        byPath.set(attachment.path, attachment);
      }

      return [...byPath.values()];
    });
    setErrorMessage(null);
  };

  const removeAttachment = (attachmentPath: string) => {
    setAttachments((current) =>
      current.filter((currentAttachment) => currentAttachment.path !== attachmentPath),
    );
  };

  const modelLabel = useMemo(() => getModelLabel(model), [model]);

  return {
    attachments,
    canSend,
    clearError: () => setErrorMessage(null),
    draft,
    errorMessage,
    isSending,
    modelButtonRef,
    modelLabel,
    modelMenuOpen: openMenu === "model",
    modelMenuRef,
    pickAttachments,
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    thinkingButtonRef,
    thinkingLevelLabels,
    thinkingMenuOpen: openMenu === "thinking",
    thinkingMenuRef,
  };
}
