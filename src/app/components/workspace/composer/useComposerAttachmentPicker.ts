import { useState, type Dispatch, type SetStateAction } from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import { mergeComposerAttachments } from "../../../../../shared/composer-attachments";

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

  const fetchPickerEntries = async (path?: string | null, rootPath?: string | null) => {
    return await onListAttachmentEntries({
      projectId: pickerRootPath,
      path: path ?? null,
      rootPath: rootPath ?? pickerState?.rootPath ?? pickerRootPath ?? null,
    });
  };

  const loadPickerEntries = async (path?: string | null, rootPath?: string | null) => {
    setPickerLoading(true);

    try {
      const nextPickerState = await fetchPickerEntries(path, rootPath);
      setPickerState(nextPickerState);
      setErrorMessage(null);
      return nextPickerState;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load files.");
      return null;
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

    const initialPickerState = await loadPickerEntries(pickerRootPath, pickerRootPath);
    if (
      !initialPickerState?.homePath ||
      initialPickerState.homePath === initialPickerState.rootPath
    ) {
      return;
    }

    await loadPickerEntries(initialPickerState.homePath, initialPickerState.homePath);
  };

  const openPickerDirectory = async (path: string) => {
    await loadPickerEntries(path);
  };

  const openPickerRoot = async (rootPath: string) => {
    await loadPickerEntries(rootPath, rootPath);
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

  const attachPickerAttachments = (
    nextAttachments: ComposerAttachment[],
    options?: { closeMenu?: boolean },
  ) => {
    if (nextAttachments.length === 0) {
      return;
    }

    const attachedPaths = new Set(nextAttachments.map((attachment) => attachment.path));

    setAttachments((current) => mergeComposerAttachments(current, nextAttachments));
    setPendingPickerAttachments((current) =>
      current.filter((attachment) => !attachedPaths.has(attachment.path)),
    );

    if (options?.closeMenu) {
      setOpenMenu(null);
    }

    setErrorMessage(null);
  };

  const removeAttachment = (attachmentPath: string) => {
    setAttachments((current) =>
      current.filter((currentAttachment) => currentAttachment.path !== attachmentPath),
    );
  };

  const clearAttachments = () => {
    setAttachments([]);
    setErrorMessage(null);
  };

  return {
    attachPickerAttachments,
    clearAttachments,
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
