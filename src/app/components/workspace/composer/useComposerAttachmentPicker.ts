import { useState, type Dispatch, type SetStateAction } from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";

function mergeAttachments(current: ComposerAttachment[], next: ComposerAttachment[]) {
  const byPath = new Map(current.map((attachment) => [attachment.path, attachment]));

  for (const attachment of next) {
    byPath.set(attachment.path, attachment);
  }

  return [...byPath.values()];
}

type UseComposerAttachmentPickerProps = {
  openMenu: "model" | "picker" | null;
  pickerRootPath: string;
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setOpenMenu: Dispatch<SetStateAction<"model" | "picker" | null>>;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
};

export function useComposerAttachmentPicker({
  openMenu,
  pickerRootPath,
  setAttachments,
  setErrorMessage,
  setOpenMenu,
  onListAttachmentEntries,
}: UseComposerAttachmentPickerProps) {
  const [pickerState, setPickerState] = useState<ComposerFilePickerState | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pendingPickerAttachments, setPendingPickerAttachments] = useState<ComposerAttachment[]>(
    [],
  );

  const loadPickerEntries = async (path?: string | null, rootPath?: string | null) => {
    setPickerLoading(true);

    try {
      const nextPickerState = await onListAttachmentEntries({
        projectId: pickerRootPath,
        path: path ?? null,
        rootPath: rootPath ?? pickerState?.rootPath ?? pickerRootPath ?? null,
      });
      setPickerState(nextPickerState);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load files.");
    } finally {
      setPickerLoading(false);
    }
  };

  const pickAttachments = async () => {
    if (openMenu === "picker") {
      setOpenMenu(null);
      return;
    }

    setPendingPickerAttachments([]);
    setOpenMenu("picker");
    await loadPickerEntries(pickerRootPath, pickerRootPath);
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

  return {
    attachPendingPickerAttachments,
    navigatePickerUp,
    openPickerDirectory,
    openPickerRoot,
    pendingPickerAttachments,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  };
}
