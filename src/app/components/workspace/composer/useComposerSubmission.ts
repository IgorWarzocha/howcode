import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { composerDraftStore } from "./composerDraftStore";
import { withComposerSendLock } from "./composerSendLock";
import { submitComposerDraft } from "./submitComposerDraft";

type UseComposerSubmissionProps = {
  composerScopeKey: string;
  draftThreadId: string | null;
  isSending: boolean;
  isStreaming: boolean;
  onAction: DesktopActionInvoker;
  projectId: string;
  sessionPath: string | null;
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  setDraftValue: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setOpenMenu: Dispatch<SetStateAction<"model" | "picker" | null>>;
  stopDictationAndFlush: () => Promise<void>;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  activeComposerScopeKeyRef: MutableRefObject<string>;
  activeDraftThreadIdRef: MutableRefObject<string | null>;
  attachmentsRef: MutableRefObject<ComposerAttachment[]>;
  draftValueRef: MutableRefObject<string>;
  sendLockRef: MutableRefObject<boolean>;
  skipNextDraftPersistenceRef: MutableRefObject<string | null>;
};

export function useComposerSubmission({
  composerScopeKey,
  draftThreadId,
  isSending,
  isStreaming,
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
}: UseComposerSubmissionProps) {
  const send = useCallback(async () => {
    if (isSending || sendLockRef.current) {
      return;
    }

    await withComposerSendLock(sendLockRef, async () => {
      const submittedScopeKey = composerScopeKey;
      const submittedProjectId = projectId;
      const submittedSessionPath = sessionPath;
      const submittedDraftThreadId = draftThreadId;

      setIsSending(true);

      try {
        await stopDictationAndFlush();

        if (activeComposerScopeKeyRef.current !== submittedScopeKey) {
          return;
        }

        const textToSend = draftValueRef.current.trim();
        const submittedAttachments = attachmentsRef.current;
        if (textToSend.length === 0 && submittedAttachments.length === 0) {
          return;
        }

        const submittedDraft = textToSend;

        setErrorMessage(null);
        setOpenMenu(null);
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
  }, [
    activeComposerScopeKeyRef,
    activeDraftThreadIdRef,
    attachmentsRef,
    composerScopeKey,
    draftThreadId,
    draftValueRef,
    isSending,
    onAction,
    projectId,
    sendLockRef,
    sessionPath,
    setAttachments,
    setDraftValue,
    setErrorMessage,
    setIsSending,
    setOpenMenu,
    skipNextDraftPersistenceRef,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ]);

  const stop = useCallback(async () => {
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
  }, [isSending, isStreaming, onAction, projectId, sessionPath, setErrorMessage, setIsSending]);

  return {
    send,
    stop,
  };
}
