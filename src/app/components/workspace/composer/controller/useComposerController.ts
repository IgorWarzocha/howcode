import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { DesktopAction } from "../../../../desktop/actions";
import { getErrorMessage } from "../../../../desktop/error-messages";
import type {
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from "../../../../desktop/types";
import type { View } from "../../../../types";
import { useDismissibleLayer } from "../../../../hooks/useDismissibleLayer";
import { useComposerAttachmentPicker } from "../useComposerAttachmentPicker";
import { useComposerClipboardHandlers } from "../useComposerClipboardHandlers";
import { useComposerDictation } from "../useComposerDictation";
import { useComposerSubmission } from "../useComposerSubmission";
import { useComposerDraftState } from "./useComposerDraftState";

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
  isExtensionCommandRunning: boolean;
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
  isExtensionCommandRunning,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  onAction,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
}: UseComposerControllerProps) {
  const [openMenu, setOpenMenu] = useState<"model" | "picker" | null>(null);
  const [localExtensionCommandRunning, setLocalExtensionCommandRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const sendLockRef = useRef(false);
  const {
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachments,
    attachmentsRef,
    composerScopeKey,
    draft,
    draftThreadId,
    draftValueRef,
    setAttachmentValue,
    setDraftValue,
    skipNextDraftPersistenceRef,
  } = useComposerDraftState({
    projectId,
    sessionPath,
    openMenu,
    setOpenMenu,
    setErrorMessage,
    restoredQueuedPrompt,
    onRestoredQueuedPromptApplied,
  });

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

  const extensionCommandRunning = isExtensionCommandRunning || localExtensionCommandRunning;
  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) && !isSending && !isCompacting;

  useEffect(() => {
    void composerScopeKey;
    setLocalExtensionCommandRunning(false);
  }, [composerScopeKey]);

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
    setAttachments: setAttachmentValue,
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
      setErrorMessage(getErrorMessage(error, "Could not update the composer."));
    }
  };

  const { compact, send, sendExtensionCommand, stop } = useComposerSubmission({
    composerScopeKey,
    draftThreadId,
    isSending,
    isStreaming,
    isCompacting,
    onAction,
    projectId,
    sessionPath,
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage,
    extensionCommandRunning,
    setExtensionCommandRunning: setLocalExtensionCommandRunning,
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
    setAttachments: setAttachmentValue,
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
    extensionCommandRunning,
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
    sendExtensionCommand,
    setDraft: setDraftValue,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  };
}
