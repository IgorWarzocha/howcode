import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
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
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
};

export function useComposerController({
  model,
  projectId,
  sessionPath,
  onAction,
  onPickAttachments,
  onListAttachmentEntries,
}: UseComposerControllerProps) {
  const draftThreadId = useMemo(
    () => getComposerDraftThreadId({ projectId, sessionPath }),
    [projectId, sessionPath],
  );
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [openMenu, setOpenMenu] = useState<"model" | "picker" | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<ComposerFilePickerState | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pendingPickerAttachments, setPendingPickerAttachments] = useState<ComposerAttachment[]>(
    [],
  );
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
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
    refs: [pickerButtonRef, pickerPanelRef, modelButtonRef, modelMenuRef],
  });

  const canSend = draft.trim().length > 0 && !isSending;

  const mergeAttachments = (current: ComposerAttachment[], next: ComposerAttachment[]) => {
    const byPath = new Map(current.map((attachment) => [attachment.path, attachment]));

    for (const attachment of next) {
      byPath.set(attachment.path, attachment);
    }

    return [...byPath.values()];
  };

  const loadPickerEntries = async (path?: string | null, rootPath?: string | null) => {
    setPickerLoading(true);

    try {
      const nextPickerState = await onListAttachmentEntries({
        projectId,
        path: path ?? null,
        rootPath: rootPath ?? pickerState?.rootPath ?? projectId ?? null,
      });
      setPickerState(nextPickerState);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load files.");
    } finally {
      setPickerLoading(false);
    }
  };

  const runComposerAction = async (
    action: DesktopAction,
    payload: Record<string, unknown>,
    options?: { closeMenu?: boolean },
  ) => {
    try {
      await onAction(action, payload);
      setErrorMessage(null);
      if (options?.closeMenu ?? true) {
        setOpenMenu(null);
      }
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
    if (openMenu === "picker") {
      setOpenMenu(null);
      return;
    }

    setPendingPickerAttachments([]);
    setOpenMenu("picker");
    await loadPickerEntries(projectId, projectId);
  };

  const openPickerDirectory = async (path: string) => {
    await loadPickerEntries(path);
  };

  const openPickerRoot = async (rootPath: string) => {
    await loadPickerEntries(rootPath, rootPath);
  };

  const navigatePickerUp = async () => {
    if (!pickerState?.parentPath) {
      return;
    }

    await loadPickerEntries(pickerState.parentPath);
  };

  const togglePendingPickerAttachment = (attachment: ComposerAttachment) => {
    setPendingPickerAttachments((current) => {
      const exists = current.some(
        (currentAttachment) => currentAttachment.path === attachment.path,
      );

      return exists
        ? current.filter((currentAttachment) => currentAttachment.path !== attachment.path)
        : [...current, attachment];
    });
  };

  const attachPendingPickerAttachments = () => {
    if (pendingPickerAttachments.length === 0) {
      return;
    }

    setAttachments((current) => mergeAttachments(current, pendingPickerAttachments));
    setPendingPickerAttachments([]);
    setOpenMenu(null);
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
    pickerButtonRef,
    pickerLoading,
    pickerOpen: openMenu === "picker",
    pickerPanelRef,
    pickerState,
    modelButtonRef,
    modelLabel,
    modelMenuOpen: openMenu === "model",
    modelMenuRef,
    pendingPickerAttachments,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    navigatePickerUp,
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    attachPendingPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  };
}
