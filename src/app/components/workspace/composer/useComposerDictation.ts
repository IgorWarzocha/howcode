import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { DictationState } from "../../../desktop/types";
import {
  appendDictatedText,
  canUseLocalDictationCapture,
  startLocalDictationCapture,
  type LocalDictationCaptureSession,
} from "./local-dictation";

type UseComposerDictationProps = {
  activeView: string;
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  draftThreadId: string | null;
  projectId: string;
  sessionPath: string | null;
  setDraftValue: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
};

export function useComposerDictation({
  activeView,
  dictationModelId,
  dictationMaxDurationSeconds,
  draftThreadId,
  projectId,
  sessionPath,
  setDraftValue,
  setErrorMessage,
}: UseComposerDictationProps) {
  const dictationCaptureRef = useRef<LocalDictationCaptureSession | null>(null);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationInterimText, setDictationInterimText] = useState("");
  const [dictationState, setDictationState] = useState<DictationState | null>(null);
  const dictationSessionTokenRef = useRef(0);
  const dictationFlushPromiseRef = useRef<Promise<void> | null>(null);
  const dictationScopeKey = useMemo(
    () => `${activeView}::${projectId}::${sessionPath ?? ""}::${draftThreadId ?? ""}`,
    [activeView, draftThreadId, projectId, sessionPath],
  );
  const activeDictationScopeKeyRef = useRef(dictationScopeKey);

  activeDictationScopeKeyRef.current = dictationScopeKey;

  const clearPendingDictationFlush = useCallback(() => {
    dictationFlushPromiseRef.current = null;
  }, []);

  const clearDictationSession = useCallback(() => {
    dictationCaptureRef.current = null;
    setDictationActive(false);
    setDictationInterimText("");
  }, []);

  const abortDictationSession = useCallback(() => {
    dictationSessionTokenRef.current += 1;
    clearPendingDictationFlush();

    const capture = dictationCaptureRef.current;
    if (!capture) {
      clearDictationSession();
      return;
    }

    void capture.abort().catch(() => undefined);
    clearDictationSession();
  }, [clearDictationSession, clearPendingDictationFlush]);

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
  }, [clearDictationSession, setDraftValue, setErrorMessage]);

  useEffect(() => {
    void dictationScopeKey;
    abortDictationSession();
  }, [abortDictationSession, dictationScopeKey]);

  useEffect(() => abortDictationSession, [abortDictationSession]);

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

  const dictationMissingModel = dictationState?.reason === "missing-model";
  const dictationSupported = useMemo(
    () =>
      canUseLocalDictationCapture() &&
      typeof window.piDesktop?.transcribeDictation === "function" &&
      (dictationState?.available ?? true),
    [dictationState],
  );

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
      let availability = dictationState;

      if (window.piDesktop.getDictationState) {
        try {
          availability = await window.piDesktop.getDictationState();
        } catch {
          setErrorMessage("Could not verify local dictation availability in this runtime.");
          return "unavailable" as const;
        }
      }

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

      const capture = await startLocalDictationCapture(dictationMaxDurationSeconds);
      dictationSessionTokenRef.current += 1;
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
      const pendingFlush = dictationFlushPromiseRef.current;
      dictationSessionTokenRef.current += 1;
      clearPendingDictationFlush();
      clearDictationSession();
      await pendingFlush.catch(() => undefined);
    }
  }, [abortDictationSession, clearDictationSession, clearPendingDictationFlush]);

  return {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  };
}
