import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SetStateAction,
} from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from "../../../desktop/types";
import type { View } from "../../../types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { mergeDraftWithRestoredQueuedPrompt } from "./composer-queue.helpers";
import { composerDraftStore, getComposerDraftThreadId } from "./composerDraftStore";
import { useComposerAttachmentPicker } from "./useComposerAttachmentPicker";
import { useComposerClipboardHandlers } from "./useComposerClipboardHandlers";
import { useComposerDictation } from "./useComposerDictation";
import { useComposerSubmission } from "./useComposerSubmission";

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
  activeView: View;
  composerPanelRef: RefObject<HTMLDivElement | null>;
  mainViewRef: RefObject<HTMLElement | null>;
  workspaceFooterRef: RefObject<HTMLElement | null>;
  model: ComposerModel | null;
  projectId: string;
  sessionPath: string | null;
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  isStreaming: boolean;
  isCompacting: boolean;
  restoredQueuedPrompt: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  onAction: DesktopActionInvoker;
  onRestoredQueuedPromptApplied: () => void;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
};

export function useComposerController({
  activeView,
  composerPanelRef,
  mainViewRef,
  workspaceFooterRef,
  model,
  projectId,
  sessionPath,
  dictationModelId,
  dictationMaxDurationSeconds,
  isStreaming,
  isCompacting,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  onAction,
  onRestoredQueuedPromptApplied,
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
  const composerScopeKey = useMemo(
    () => `${projectId}::${sessionPath ?? ""}::${draftThreadId ?? ""}`,
    [draftThreadId, projectId, sessionPath],
  );
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const activeComposerScopeKeyRef = useRef(composerScopeKey);
  const activeDraftThreadIdRef = useRef<string | null>(draftThreadId);
  const skipNextDraftPersistenceRef = useRef<string | null>(null);
  const attachmentsRef = useRef<ComposerAttachment[]>([]);
  const draftValueRef = useRef("");
  const sendLockRef = useRef(false);

  activeDraftThreadIdRef.current = draftThreadId;
  activeComposerScopeKeyRef.current = composerScopeKey;
  attachmentsRef.current = attachments;

  const setDraftValue = useCallback((value: SetStateAction<string>) => {
    const nextValue =
      typeof value === "function"
        ? (value as (current: string) => string)(draftValueRef.current)
        : value;
    draftValueRef.current = nextValue;
    setDraft(nextValue);
  }, []);

  useEffect(() => {
    skipNextDraftPersistenceRef.current = draftThreadId;

    const persistedDraft = draftThreadId ? composerDraftStore.getDraft(draftThreadId) : null;
    setDraftValue(persistedDraft?.prompt ?? "");
    setAttachments(persistedDraft?.attachments ?? []);
    setOpenMenu(persistedDraft?.pickerOpen ? "picker" : null);
    setErrorMessage(null);
  }, [draftThreadId, setDraftValue]);

  useEffect(() => {
    if (!draftThreadId) {
      return;
    }

    if (skipNextDraftPersistenceRef.current === draftThreadId) {
      skipNextDraftPersistenceRef.current = null;
      return;
    }

    composerDraftStore.setDraft(draftThreadId, {
      prompt: draft,
      attachments,
      pickerOpen: openMenu === "picker",
    });
  }, [attachments, draft, draftThreadId, openMenu]);

  useEffect(() => {
    if (!restoredQueuedPrompt) {
      return;
    }

    setDraftValue((currentDraft) =>
      mergeDraftWithRestoredQueuedPrompt(currentDraft, restoredQueuedPrompt),
    );
    setErrorMessage(null);
    onRestoredQueuedPromptApplied();
  }, [onRestoredQueuedPromptApplied, restoredQueuedPrompt, setDraftValue]);

  useDismissibleLayer({
    open: openMenu === "model",
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  });

  useEffect(() => {
    if (openMenu !== "picker") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return;
      }

      if (composerPanelRef.current?.contains(target)) {
        return;
      }

      if (mainViewRef.current?.contains(target) || workspaceFooterRef.current?.contains(target)) {
        setOpenMenu((current) => (current === "picker" ? null : current));
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [composerPanelRef, mainViewRef, openMenu, workspaceFooterRef]);

  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) && !isSending && !isCompacting;

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  } = useComposerDictation({
    activeView,
    dictationModelId,
    dictationMaxDurationSeconds,
    draftThreadId,
    projectId,
    sessionPath,
    setDraftValue,
    setErrorMessage,
  });

  const {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  } = useComposerAttachmentPicker({
    openMenu,
    pickerRootPath: projectId,
    pickerSessionKey: draftThreadId,
    setAttachments,
    setErrorMessage,
    setOpenMenu,
    onListAttachmentEntries,
  });

  const runComposerAction = async (
    action: DesktopAction,
    payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
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

  const { compact, send, stop } = useComposerSubmission({
    composerScopeKey,
    draftThreadId,
    isSending,
    isStreaming,
    isCompacting,
    onAction,
    projectId,
    sessionPath,
    setAttachments,
    setDraftValue,
    setErrorMessage,
    setIsSending,
    setOpenMenu,
    stopDictationAndFlush,
    streamingBehaviorPreference,
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachmentsRef,
    draftValueRef,
    sendLockRef,
    skipNextDraftPersistenceRef,
  });

  const modelLabel = useMemo(() => getModelLabel(model), [model]);

  const { handleDrop, handlePaste } = useComposerClipboardHandlers({
    setAttachments,
    setDraftValue,
    setErrorMessage,
  });

  return {
    attachments,
    handleDrop,
    handlePaste,
    cancelDictation,
    canSend,
    clearAttachments,
    clearError: () => setErrorMessage(null),
    draft,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
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
    isStreaming,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    removeAttachment,
    runComposerAction,
    compact,
    send,
    setDraft: setDraftValue,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  };
}
