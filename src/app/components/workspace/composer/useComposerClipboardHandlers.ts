import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  mergeComposerAttachments,
  normalizeComposerAttachments,
} from "../../../../../shared/composer-attachments";
import type {
  ComposerAttachment,
  DesktopClipboardFilePaths,
  DesktopClipboardSnapshot,
} from "../../../desktop/types";
import {
  getAttachmentKindsForPathsQuery,
  getPathForFileQuery,
  readClipboardFilePathsQuery,
  readClipboardImageQuery,
  readClipboardSnapshotQuery,
} from "../../../query/desktop-query";
import {
  attachmentClipboardSnapshotFormats,
  getComposerAttachmentsFromClipboardData,
  getComposerAttachmentsFromClipboardFilePaths,
  getComposerAttachmentsFromClipboardSnapshot,
  getPreferredClipboardTextFromClipboardData,
  getPreferredClipboardTextFromClipboardFilePaths,
  getPreferredClipboardTextFromClipboardSnapshot,
  hasAttachmentHintInClipboardData,
  hasFilePayloadInClipboardData,
} from "./composer-paste-attachments";
import { buildLocalAttachmentKindLookup } from "./composer-attachment-kind-lookup";

function applyPastedTextToTextarea(textarea: HTMLTextAreaElement, pastedText: string) {
  const selectionStart = textarea.selectionStart ?? textarea.value.length;
  const selectionEnd = textarea.selectionEnd ?? textarea.value.length;
  textarea.setRangeText(pastedText, selectionStart, selectionEnd, "end");
  return textarea.value;
}

function resolveDesktopFilePath(file: {
  path?: string | null;
  name?: string | null;
  type?: string | null;
}) {
  return getPathForFileQuery(file as File) ?? null;
}

async function resolveDesktopAttachmentKinds(paths: string[]) {
  try {
    return await getAttachmentKindsForPathsQuery(paths);
  } catch {
    return null;
  }
}

async function normalizeDesktopAttachments(attachments: ComposerAttachment[]) {
  const { fallbackKindsByPath, localPaths } = buildLocalAttachmentKindLookup(attachments);
  const kindsByPath = await resolveDesktopAttachmentKinds(localPaths);
  const hasLookup = kindsByPath !== null;

  return normalizeComposerAttachments(attachments, {
    resolveAttachmentKind: (path) => {
      if (hasLookup && kindsByPath && Object.prototype.hasOwnProperty.call(kindsByPath, path)) {
        return kindsByPath[path] ?? null;
      }

      return fallbackKindsByPath[path] ?? null;
    },
  });
}

type UseComposerClipboardHandlersInput = {
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  setDraftValue: (value: SetStateAction<string>) => void;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
};

export function useComposerClipboardHandlers({
  setAttachments,
  setDraftValue,
  setErrorMessage,
}: UseComposerClipboardHandlersInput) {
  const handlePaste = useCallback(
    async (request: {
      clipboardData: DataTransfer | null;
      textarea: HTMLTextAreaElement;
    }) => {
      const { clipboardData, textarea } = request;
      const directPastedText = getPreferredClipboardTextFromClipboardData(clipboardData);
      const hasDirectAttachmentHint = hasAttachmentHintInClipboardData(clipboardData);
      const hasDirectFilePayload = hasFilePayloadInClipboardData(clipboardData);

      const directAttachments = getComposerAttachmentsFromClipboardData(clipboardData, {
        resolveFilePath: resolveDesktopFilePath,
      });
      const hasDirectAttachmentCandidate = directAttachments.length > 0;
      const normalizedDirectAttachments = await normalizeDesktopAttachments(directAttachments);
      if (normalizedDirectAttachments.length > 0) {
        setAttachments((current) => mergeComposerAttachments(current, normalizedDirectAttachments));
        setErrorMessage(null);
        return;
      }

      if (directPastedText && !hasDirectAttachmentHint) {
        setDraftValue(applyPastedTextToTextarea(textarea, directPastedText));
        setErrorMessage(null);
        return;
      }

      let fallbackSnapshot: DesktopClipboardSnapshot | null = null;
      let fallbackClipboardFilePaths: DesktopClipboardFilePaths | null = null;
      try {
        fallbackClipboardFilePaths = await readClipboardFilePathsQuery();
      } catch {
        fallbackClipboardFilePaths = null;
      }

      const nativeAttachments = getComposerAttachmentsFromClipboardFilePaths(
        fallbackClipboardFilePaths,
      );
      const normalizedNativeAttachments = await normalizeDesktopAttachments(nativeAttachments);
      if (normalizedNativeAttachments.length > 0) {
        setAttachments((current) => mergeComposerAttachments(current, normalizedNativeAttachments));
        setErrorMessage(null);
        return;
      }

      try {
        fallbackSnapshot = await readClipboardSnapshotQuery(attachmentClipboardSnapshotFormats);
      } catch {
        fallbackSnapshot = null;
      }

      const fallbackAttachments = getComposerAttachmentsFromClipboardSnapshot(fallbackSnapshot);
      const normalizedFallbackAttachments = await normalizeDesktopAttachments(fallbackAttachments);
      if (normalizedFallbackAttachments.length > 0) {
        setAttachments((current) =>
          mergeComposerAttachments(current, normalizedFallbackAttachments),
        );
        setErrorMessage(null);
        return;
      }

      if (hasDirectFilePayload) {
        const clipboardImageAttachment = await readClipboardImageQuery().catch(() => null);
        if (clipboardImageAttachment) {
          setAttachments((current) =>
            mergeComposerAttachments(current, [clipboardImageAttachment]),
          );
          setErrorMessage(null);
          return;
        }
      }

      const pastedText =
        directPastedText ||
        getPreferredClipboardTextFromClipboardFilePaths(fallbackClipboardFilePaths) ||
        getPreferredClipboardTextFromClipboardSnapshot(fallbackSnapshot);

      if (!pastedText) {
        if (hasDirectAttachmentHint) {
          setErrorMessage(
            "Could not attach the pasted file path. Check that the file still exists.",
          );
        }
        return;
      }

      if (hasDirectAttachmentCandidate && hasDirectAttachmentHint) {
        setErrorMessage("Could not attach the pasted file path. Check that the file still exists.");
        return;
      }

      const nextValue = applyPastedTextToTextarea(textarea, pastedText);
      setDraftValue(nextValue);
      setErrorMessage(null);

      const nextCursorPosition = textarea.selectionStart ?? nextValue.length;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [setAttachments, setDraftValue, setErrorMessage],
  );

  const handleDrop = useCallback(
    async (dataTransfer: DataTransfer | null) => {
      const droppedAttachments = await normalizeDesktopAttachments(
        getComposerAttachmentsFromClipboardData(dataTransfer, {
          resolveFilePath: resolveDesktopFilePath,
        }),
      );
      if (droppedAttachments.length === 0) {
        return false;
      }

      setAttachments((current) => mergeComposerAttachments(current, droppedAttachments));
      setErrorMessage(null);
      return true;
    },
    [setAttachments, setErrorMessage],
  );

  return { handleDrop, handlePaste };
}
