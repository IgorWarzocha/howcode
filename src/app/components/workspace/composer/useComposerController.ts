import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationState,
} from "../../../desktop/types";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import {
  appendDictatedText,
  canUseLocalDictationCapture,
  startLocalDictationCapture,
  type LocalDictationCaptureSession,
} from "./local-dictation";
import { withComposerSendLock } from "./composerSendLock";
import { mergeDraftWithRestoredQueuedPrompt } from "./composer-queue.helpers";
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
  dictationModelId: string | null;
  isStreaming: boolean;
  restoredQueuedPrompt: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  onAction: DesktopActionInvoker;
  onRestoredQueuedPromptApplied: () => void;
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
  dictationModelId,
  isStreaming,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  onAction,
  onRestoredQueuedPromptApplied,
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
  const dictationCaptureRef = useRef<LocalDictationCaptureSession | null>(null);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationInterimText, setDictationInterimText] = useState("");
  const [dictationState, setDictationState] = useState<DictationState | null>(null);
  const draftValueRef = useRef("");
  const dictationSessionTokenRef = useRef(0);
  const dictationSettledPromiseRef = useRef<Promise<void> | null>(null);
  const dictationSettledResolverRef = useRef<(() => void) | null>(null);
  const dictationFlushPromiseRef = useRef<Promise<void> | null>(null);
  const sendLockRef = useRef(false);

  activeDraftThreadIdRef.current = draftThreadId;

  const setDraftValue = useCallback((value: SetStateAction<string>) => {
    const nextValue =
      typeof value === "function"
        ? (value as (current: string) => string)(draftValueRef.current)
        : value;
    draftValueRef.current = nextValue;
    setDraft(nextValue);
  }, []);

  const resolveDictationSettled = useCallback(() => {
    dictationSettledResolverRef.current?.();
    dictationSettledResolverRef.current = null;
    dictationSettledPromiseRef.current = null;
  }, []);

  const clearDictationSession = useCallback(() => {
    dictationCaptureRef.current = null;
    setDictationActive(false);
    setDictationInterimText("");
    resolveDictationSettled();
  }, [resolveDictationSettled]);

  const abortDictationSession = useCallback(() => {
    dictationSessionTokenRef.current += 1;

    const capture = dictationCaptureRef.current;
    if (!capture) {
      clearDictationSession();
      return;
    }

    void capture.abort();
    clearDictationSession();
  }, [clearDictationSession]);

  const stopDictationAndFlush = useCallback(async () => {
    if (dictationFlushPromiseRef.current) {
      await dictationFlushPromiseRef.current;
      return;
    }

    const capture = dictationCaptureRef.current;
    if (!capture) {
      return;
    }

    dictationCaptureRef.current = null;

    const submittedScopeKey = activeDictationScopeKeyRef.current;
    const submittedSessionToken = dictationSessionTokenRef.current;
    const flushPromise = (async () => {
      setDictationActive(false);
      setDictationInterimText("Transcribing…");

      try {
        const audio = await capture.stop();

        if (
          activeDictationScopeKeyRef.current !== submittedScopeKey ||
          dictationSessionTokenRef.current !== submittedSessionToken
        ) {
          return;
        }

        if (!audio.audioBase64) {
          setErrorMessage("No speech was captured.");
          return;
        }

        if (!window.piDesktop?.transcribeDictation) {
          setErrorMessage("Local dictation is unavailable in this runtime.");
          return;
        }

        const result = await window.piDesktop.transcribeDictation({
          audioBase64: audio.audioBase64,
          sampleRate: audio.sampleRate,
          language: navigator.language || null,
        });

        if (
          activeDictationScopeKeyRef.current !== submittedScopeKey ||
          dictationSessionTokenRef.current !== submittedSessionToken
        ) {
          return;
        }

        if (!result.ok) {
          setErrorMessage(result.error ?? "Could not transcribe dictation.");
          return;
        }

        if (result.text.trim()) {
          setDraftValue((current) => appendDictatedText(current, result.text));
          setErrorMessage(null);
        }
      } catch (error) {
        if (
          activeDictationScopeKeyRef.current === submittedScopeKey &&
          dictationSessionTokenRef.current === submittedSessionToken
        ) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not stop local dictation.",
          );
        }
      } finally {
        dictationFlushPromiseRef.current = null;

        if (
          activeDictationScopeKeyRef.current === submittedScopeKey &&
          dictationSessionTokenRef.current === submittedSessionToken
        ) {
          clearDictationSession();
        }
      }
    })();

    dictationFlushPromiseRef.current = flushPromise;
    await flushPromise;
  }, [clearDictationSession, setDraftValue]);

  const dictationScopeKey = useMemo(
    () => `${projectId}::${sessionPath ?? ""}::${draftThreadId ?? ""}`,
    [draftThreadId, projectId, sessionPath],
  );
  const activeDictationScopeKeyRef = useRef(dictationScopeKey);

  activeDictationScopeKeyRef.current = dictationScopeKey;

  useEffect(() => {
    void dictationScopeKey;
    abortDictationSession();
  }, [abortDictationSession, dictationScopeKey]);

  useEffect(() => abortDictationSession, [abortDictationSession]);

  useEffect(() => {
    skipNextDraftPersistenceRef.current = draftThreadId;

    const persistedDraft = draftThreadId ? composerDraftStore.getDraft(draftThreadId) : null;
    setDraftValue(persistedDraft?.prompt ?? "");
    setAttachments(persistedDraft?.attachments ?? []);
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

    composerDraftStore.setDraft(draftThreadId, { prompt: draft, attachments });
  }, [attachments, draft, draftThreadId]);

  useEffect(() => {
    if (!restoredQueuedPrompt) {
      return;
    }

    setDraftValue((currentDraft) =>
      mergeDraftWithRestoredQueuedPrompt(currentDraft, restoredQueuedPrompt),
    );
    setOpenMenu(null);
    setErrorMessage(null);
    onRestoredQueuedPromptApplied();
  }, [onRestoredQueuedPromptApplied, restoredQueuedPrompt, setDraftValue]);

  useDismissibleLayer({
    open: openMenu !== null,
    onDismiss: () => setOpenMenu(null),
    refs: [pickerButtonRef, pickerPanelRef, modelButtonRef, modelMenuRef],
  });

  const canSend = draft.trim().length > 0 && !isSending;
  const dictationMissingModel = dictationState?.reason === "missing-model";
  const dictationSupported = useMemo(
    () =>
      canUseLocalDictationCapture() &&
      typeof window.piDesktop?.transcribeDictation === "function" &&
      (dictationState?.available ?? true),
    [dictationState],
  );

  useEffect(() => {
    let disposed = false;

    void dictationModelId;

    if (!window.piDesktop?.getDictationState) {
      return;
    }

    void window.piDesktop
      .getDictationState()
      .then((state) => {
        if (!disposed) {
          setDictationState(state);
        }
      })
      .catch(() => {
        if (!disposed) {
          setDictationState(null);
        }
      });

    return () => {
      disposed = true;
    };
  }, [dictationModelId]);

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

  const send = async () => {
    if (isSending || sendLockRef.current) {
      return;
    }

    await withComposerSendLock(sendLockRef, async () => {
      const submittedScopeKey = dictationScopeKey;
      const submittedProjectId = projectId;
      const submittedSessionPath = sessionPath;
      const submittedDraftThreadId = draftThreadId;
      const submittedAttachments = attachments;

      setIsSending(true);

      try {
        await stopDictationAndFlush();

        if (activeDictationScopeKeyRef.current !== submittedScopeKey) {
          return;
        }

        const textToSend = draftValueRef.current.trim();
        if (textToSend.length === 0) {
          return;
        }

        const submittedDraft = textToSend;

        setErrorMessage(null);
        skipNextDraftPersistenceRef.current = submittedDraftThreadId;
        setDraftValue("");
        setAttachments([]);

        const result = await submitComposerDraft({
          draft: submittedDraft,
          attachments: submittedAttachments,
          draftThreadId: submittedDraftThreadId,
          isSending: false,
          projectId: submittedProjectId,
          sessionPath: submittedSessionPath,
          streamingBehaviorPreference,
          onAction,
          clearStoredDraft: (threadId) => composerDraftStore.clearThreadDraft(threadId),
        });

        if (
          result.status === "error" &&
          activeDraftThreadIdRef.current === submittedDraftThreadId
        ) {
          setDraftValue((currentDraft) => (currentDraft.length === 0 ? result.text : currentDraft));
          setAttachments((currentAttachments) =>
            currentAttachments.length === 0 ? submittedAttachments : currentAttachments,
          );
          setErrorMessage(result.errorMessage);
        }

        if (
          result.status === "stopped" &&
          activeDraftThreadIdRef.current === submittedDraftThreadId
        ) {
          setDraftValue((currentDraft) => (currentDraft.length === 0 ? result.text : currentDraft));
          setAttachments((currentAttachments) =>
            currentAttachments.length === 0 ? submittedAttachments : currentAttachments,
          );
        }
      } finally {
        setIsSending(false);
      }
    });
  };

  const stop = async () => {
    if (!isStreaming || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = await onAction("composer.stop", {
        projectId,
        sessionPath,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(result, "Could not stop Pi.");
      if (actionErrorMessage) {
        setErrorMessage(actionErrorMessage);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not stop Pi.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleDictation = async () => {
    if (dictationCaptureRef.current) {
      void stopDictationAndFlush();
      return "stopped" as const;
    }

    if (dictationFlushPromiseRef.current) {
      await dictationFlushPromiseRef.current;
      return "stopped" as const;
    }

    if (!canUseLocalDictationCapture() || !window.piDesktop?.transcribeDictation) {
      setErrorMessage("Local dictation is unavailable in this runtime.");
      return "unavailable" as const;
    }

    try {
      const availability = window.piDesktop.getDictationState
        ? await window.piDesktop.getDictationState().catch(() => null)
        : dictationState;

      if (availability) {
        setDictationState(availability);
      }

      if (availability && !availability.available) {
        if (availability.reason === "missing-model") {
          setErrorMessage(null);
          return "setup-required" as const;
        }

        setErrorMessage(availability.error ?? "Local dictation is unavailable in this runtime.");
        return "unavailable" as const;
      }

      const capture = await startLocalDictationCapture();
      dictationSessionTokenRef.current += 1;
      dictationSettledPromiseRef.current = new Promise<void>((resolve) => {
        dictationSettledResolverRef.current = resolve;
      });
      dictationCaptureRef.current = capture;
      setDictationActive(true);
      setDictationInterimText("");
      setErrorMessage(null);
      return "started" as const;
    } catch (error) {
      clearDictationSession();
      setErrorMessage(error instanceof Error ? error.message : "Could not start local dictation.");
      return "unavailable" as const;
    }
  };

  const cancelDictation = useCallback(async () => {
    if (dictationCaptureRef.current) {
      abortDictationSession();
      return;
    }

    if (dictationFlushPromiseRef.current) {
      dictationSessionTokenRef.current += 1;
      clearDictationSession();
      await dictationFlushPromiseRef.current.catch(() => undefined);
    }
  }, [abortDictationSession, clearDictationSession]);

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
    cancelDictation,
    canSend,
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
    pendingPickerAttachments,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    navigatePickerUp,
    removeAttachment,
    runComposerAction,
    send,
    setDraft: setDraftValue,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPendingPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  };
}
