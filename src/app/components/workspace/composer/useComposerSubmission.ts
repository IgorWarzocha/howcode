import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";
import { getErrorMessage } from "../../../desktop/error-messages";
import type {
  ComposerAttachment,
  ComposerStreamingBehavior,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { composerDraftStore } from "./composerDraftStore";
import { withComposerSendLock } from "./composerSendLock";
import { isCompactSlashCommand } from "../../../../../shared/composer-slash-commands";
import { submitComposerDraft } from "./submitComposerDraft";

function isSameSubmittedDraft(currentDraft: string, submittedRawDraft: string) {
  return currentDraft === submittedRawDraft;
}

function areSameAttachments(
  currentAttachments: ComposerAttachment[],
  submittedAttachments: ComposerAttachment[],
) {
  if (currentAttachments === submittedAttachments) {
    return true;
  }

  if (currentAttachments.length !== submittedAttachments.length) {
    return false;
  }

  return currentAttachments.every((attachment, index) => {
    const submittedAttachment = submittedAttachments[index];
    return (
      attachment.path === submittedAttachment?.path &&
      attachment.name === submittedAttachment.name &&
      attachment.kind === submittedAttachment.kind
    );
  });
}

function isSameAttachment(left: ComposerAttachment, right: ComposerAttachment) {
  return left.path === right.path && left.name === right.name && left.kind === right.kind;
}

function removeSubmittedAttachments(
  currentAttachments: ComposerAttachment[],
  submittedAttachments: ComposerAttachment[],
) {
  const remainingSubmittedAttachments = [...submittedAttachments];

  return currentAttachments.filter((attachment) => {
    const submittedIndex = remainingSubmittedAttachments.findIndex((submittedAttachment) =>
      isSameAttachment(attachment, submittedAttachment),
    );

    if (submittedIndex === -1) {
      return true;
    }

    remainingSubmittedAttachments.splice(submittedIndex, 1);
    return false;
  });
}

export type ComposerPostSendCleanup = {
  clearStoredDraft: boolean;
  clearStoredPrompt: boolean;
  clearDraft: boolean;
  nextAttachments: ComposerAttachment[] | null;
  skipNextDraftPersistence: boolean;
};

export function getComposerPostSendCleanup({
  activeDraftThreadId,
  submittedDraftThreadId,
  preserveAttachments,
  currentDraft,
  submittedRawDraft,
  currentAttachments,
  submittedAttachments,
}: {
  activeDraftThreadId: string | null;
  submittedDraftThreadId: string | null;
  preserveAttachments: boolean;
  currentDraft: string;
  submittedRawDraft: string;
  currentAttachments: ComposerAttachment[];
  submittedAttachments: ComposerAttachment[];
}): ComposerPostSendCleanup {
  const isActiveSubmittedDraft = activeDraftThreadId === submittedDraftThreadId;
  const draftUnchanged = currentDraft === submittedRawDraft;
  const attachmentsUnchanged = areSameAttachments(currentAttachments, submittedAttachments);
  const nextAttachments =
    isActiveSubmittedDraft && !preserveAttachments
      ? removeSubmittedAttachments(currentAttachments, submittedAttachments)
      : null;
  const shouldClearStoredDraft = Boolean(
    submittedDraftThreadId &&
      !preserveAttachments &&
      (!isActiveSubmittedDraft || (draftUnchanged && attachmentsUnchanged)),
  );
  const shouldClearStoredPrompt = Boolean(
    submittedDraftThreadId && preserveAttachments && (!isActiveSubmittedDraft || draftUnchanged),
  );
  const clearDraft = isActiveSubmittedDraft && draftUnchanged;

  return {
    clearStoredDraft: shouldClearStoredDraft,
    clearStoredPrompt: shouldClearStoredPrompt,
    clearDraft,
    nextAttachments,
    skipNextDraftPersistence:
      shouldClearStoredDraft && isActiveSubmittedDraft && draftUnchanged && attachmentsUnchanged,
  };
}

type UseComposerSubmissionProps = {
  composerScopeKey: string;
  draftThreadId: string | null;
  isSending: boolean;
  isStreaming: boolean;
  isCompacting: boolean;
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
}: UseComposerSubmissionProps) {
  const send = useCallback(async () => {
    if (isSending || isCompacting || sendLockRef.current) {
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

        const submittedRawDraft = draftValueRef.current;
        const textToSend = submittedRawDraft.trim();
        const submittedAttachments = attachmentsRef.current;
        if (textToSend.length === 0 && submittedAttachments.length === 0) {
          return;
        }

        const submittedDraft = textToSend;
        const preserveAttachments = isCompactSlashCommand(submittedDraft);

        setErrorMessage(null);
        setOpenMenu(null);

        const result = await submitComposerDraft({
          draft: submittedDraft,
          attachments: submittedAttachments,
          isSending: false,
          projectId: submittedProjectId,
          sessionPath: submittedSessionPath,
          streamingBehaviorPreference,
          onAction,
        });

        if (result.status === "sent") {
          const cleanup = getComposerPostSendCleanup({
            activeDraftThreadId: activeDraftThreadIdRef.current,
            submittedDraftThreadId,
            preserveAttachments,
            currentDraft: draftValueRef.current,
            submittedRawDraft,
            currentAttachments: attachmentsRef.current,
            submittedAttachments,
          });

          if (cleanup.clearStoredDraft && submittedDraftThreadId) {
            if (cleanup.skipNextDraftPersistence) {
              skipNextDraftPersistenceRef.current = submittedDraftThreadId;
            }
            composerDraftStore.clearThreadDraft(submittedDraftThreadId);
          }

          if (cleanup.clearStoredPrompt && submittedDraftThreadId) {
            composerDraftStore.setPrompt(submittedDraftThreadId, "");
          }

          if (cleanup.clearDraft) {
            setDraftValue("");
          }

          if (cleanup.nextAttachments !== null) {
            setAttachments(cleanup.nextAttachments);
          }
        }

        if (
          result.status === "error" &&
          activeDraftThreadIdRef.current === submittedDraftThreadId
        ) {
          if (
            isSameSubmittedDraft(draftValueRef.current, submittedRawDraft) &&
            areSameAttachments(attachmentsRef.current, submittedAttachments)
          ) {
            setDraftValue(result.text);
            setAttachments(submittedAttachments);
          }
          setErrorMessage(result.errorMessage);
        }

        if (
          result.status === "stopped" &&
          activeDraftThreadIdRef.current === submittedDraftThreadId
        ) {
          if (
            isSameSubmittedDraft(draftValueRef.current, submittedRawDraft) &&
            areSameAttachments(attachmentsRef.current, submittedAttachments)
          ) {
            setDraftValue(result.text);
            setAttachments(submittedAttachments);
          }
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
    isCompacting,
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
      setErrorMessage(getErrorMessage(error, "Could not stop Pi."));
    } finally {
      setIsSending(false);
    }
  }, [isSending, isStreaming, onAction, projectId, sessionPath, setErrorMessage, setIsSending]);

  const compact = useCallback(async () => {
    if (isSending || isStreaming || isCompacting || !sessionPath || sendLockRef.current) {
      return;
    }

    await withComposerSendLock(sendLockRef, async () => {
      setIsSending(true);
      setErrorMessage(null);

      try {
        await stopDictationAndFlush();

        const result = await submitComposerDraft({
          draft: "/compact",
          attachments: [],
          isSending: false,
          projectId,
          sessionPath,
          streamingBehaviorPreference,
          onAction,
        });

        if (result.status === "error") {
          setErrorMessage(result.errorMessage);
        }
      } finally {
        setIsSending(false);
      }
    });
  }, [
    isCompacting,
    isSending,
    isStreaming,
    onAction,
    projectId,
    sendLockRef,
    sessionPath,
    setErrorMessage,
    setIsSending,
    stopDictationAndFlush,
    streamingBehaviorPreference,
  ]);

  return {
    compact,
    send,
    stop,
  };
}
