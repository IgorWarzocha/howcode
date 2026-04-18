import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import {
  appendDictatedText,
  getBrowserSpeechRecognitionConstructor,
  getBrowserSpeechRecognitionErrorMessage,
  type BrowserSpeechRecognitionInstance,
} from "./browser-dictation";
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
  const dictationRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationInterimText, setDictationInterimText] = useState("");
  const draftValueRef = useRef("");
  const dictationSettledPromiseRef = useRef<Promise<void> | null>(null);
  const dictationSettledResolverRef = useRef<(() => void) | null>(null);
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
    dictationRecognitionRef.current = null;
    setDictationActive(false);
    setDictationInterimText("");
    resolveDictationSettled();
  }, [resolveDictationSettled]);

  const abortDictationSession = useCallback(() => {
    const recognition = dictationRecognitionRef.current;
    if (!recognition) {
      clearDictationSession();
      return;
    }

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
    clearDictationSession();
  }, [clearDictationSession]);

  const stopDictationAndFlush = useCallback(async () => {
    const recognition = dictationRecognitionRef.current;
    if (!recognition) {
      return;
    }

    const settledPromise = dictationSettledPromiseRef.current;
    setDictationInterimText("");
    recognition.stop();
    await settledPromise;
  }, []);

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
  const dictationSupported = useMemo(() => getBrowserSpeechRecognitionConstructor() !== null, []);

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

  const toggleDictation = () => {
    if (dictationRecognitionRef.current) {
      void stopDictationAndFlush();
      return;
    }

    const SpeechRecognition = getBrowserSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setErrorMessage("Browser-native dictation is unavailable in this runtime.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      dictationSettledPromiseRef.current = new Promise<void>((resolve) => {
        dictationSettledResolverRef.current = resolve;
      });
      dictationRecognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.onstart = () => {
        setDictationActive(true);
        setDictationInterimText("");
        setErrorMessage(null);
      };
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim();
          if (!transcript) {
            continue;
          }

          if (result.isFinal) {
            finalText = appendDictatedText(finalText, transcript);
          } else {
            interimText = appendDictatedText(interimText, transcript);
          }
        }

        if (finalText) {
          setDraftValue((current) => appendDictatedText(current, finalText));
        }

        setDictationInterimText(interimText);
      };
      recognition.onerror = (event) => {
        clearDictationSession();

        if (event.error !== "aborted") {
          setErrorMessage(getBrowserSpeechRecognitionErrorMessage(event.error));
        }
      };
      recognition.onend = () => {
        clearDictationSession();
      };
      recognition.start();
    } catch (error) {
      clearDictationSession();
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start browser-native dictation.",
      );
    }
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
    dictationActive,
    dictationInterimText,
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
